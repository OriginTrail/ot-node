'use strict';

const uuid = require('uuid');
const async = require('async');
const assert = require('assert');
const bunyan = require('bunyan');
const merge = require('merge');
const constants = require('./constants');
const utils = require('./utils');
const { EventEmitter } = require('events');
const RoutingTable = require('./routing-table');
const Messenger = require('./messenger');
const ErrorRules = require('./rules-errors');


/**
 * @typedef {object} AbstractNode~logger
 * @property {function} debug - Passed string of debug information
 * @property {function} info - Passed string of general information
 * @property {function} warn - Passed string of warnings
 * @property {function} error - Passed string of error message
 */

/**
 * @typedef {object} AbstractNode~transport
 * @property {function} read - Returns raw message buffer if available
 * @property {function} write - Passed raw message buffer
 */

/**
 * @typedef {object} AbstractNode~storage
 * @description Implements a subset of the LevelUP interface
 * @property {function} get
 * @property {function} put
 * @property {function} del
 * @property {function} createReadStream
 */

/**
 * @typedef AbstractNode~request
 * @property {array} contact - Peer who sent this request
 * @property {string} contact.0 - Peer's node identity
 * @property {object} contact.1 - Peer's contact information (varies by plugin)
 * @property {array|object} params - Method parameters (varies by method)
 * @property {string} method - Method name being called
 */

/**
 * @typedef AbstractNode~response
 * @property {AbstractNode~responseSend} send
 * @property {AbstractNode~responseError} error
 */

/**
 * @typedef {function} AbstractNode~next
 * @param {error|null} error - Indicates to exit the middleware stack
 */

/**
 * @method AbstractNode~responseSend
 * @param {array|object} results - Result parameters to respond with
 */

/**
 * @method AbstractNode~responseError
 * @param {string} errorMessage - Text describing the error encountered
 * @param {number} [errorCode] - Error code
 */

/**
 * Represents a network node
 */
class AbstractNode extends EventEmitter {

  /**
   * Join event is triggered when the routing table is no longer empty
   * @event AbstractNode#join
   */

  /**
   * Error event fires when a critical failure has occurred; if no handler is
   * specified, then it will throw
   * @event AbstractNode#error
   * @type {Error}
   */

  static get DEFAULTS() {
    return {
      logger: bunyan.createLogger({ name: 'kadtools' }),
      identity: utils.getRandomKeyBuffer(),
      transport: null,
      storage: null,
      messenger: new Messenger(),
      contact: {}
    };
  }

  static validate(options) {
    if (typeof options.identity === 'string') {
      options.identity = Buffer.from(options.identity, 'hex');
    }

    utils.validateStorageAdapter(options.storage);
    utils.validateLogger(options.logger);
    utils.validateTransport(options.transport);
    assert.ok(utils.keyBufferIsValid(options.identity), 'Invalid identity');
  }

  /**
   * Contructs the primary interface for a kad node
   * @constructor
   * @param {object} options
   * @param {AbstractNode~transport} options.transport - See {@tutorial transport-adapters}
   * @param {buffer} options.identity - See {@tutorial identities}
   * @param {Bucket~contact} options.contact - See {@tutorial identities}
   * @param {AbstractNode~storage} options.storage - See {@tutorial storage-adapters}
   * @param {AbstractNode~logger} [options.logger]
   * @param {Messenger} [options.messenger] - See {@tutorial messengers}
   */
  constructor(options) {
    AbstractNode.validate(options = merge(AbstractNode.DEFAULTS, options));
    super();

    this._middlewares = { '*': [] };
    this._errors = { '*': [] };
    this._pending = new Map();

    this.rpc = options.messenger;
    this.transport = options.transport;
    this.storage = options.storage;
    this.identity = options.identity;
    this.contact = options.contact;
    this.logger = options.logger;
    this.router = new RoutingTable(this.identity);

    this._init();
  }

  /**
   * Establishes listeners and creates the message pipeline
   * @private
   */
  _init() {
    this.rpc.serializer.pipe(this.transport).pipe(this.rpc.deserializer);
    this.rpc.on('error', (err) => this.logger.warn(err.message.toLowerCase()));
    this.rpc.deserializer
      .on('data', (data) => this._process(data))
      .on('unpipe', (source) => source.pipe(this.rpc.deserializer));
    this.transport
      .on('error', (err) => this.logger.warn(err.message.toLowerCase()))
      .on('unpipe', (source) => source.pipe(this.transport));

    setInterval(() => this._timeout(), constants.T_RESPONSETIMEOUT);
  }

  /**
   * Processes deserialized messages
   * @private
   */
  _process([message, contact]) {
    this._updateContact(...contact.payload.params);

    // NB: If we are receiving a request, then pass it through the middleware
    // NB: stacks to process it
    if (message.type === 'request') {
      return this.receive(
        merge({}, message.payload, { contact: contact.payload.params }),
        {
          send: (data) => {
            this.rpc.serializer.write([
              merge({ id: message.payload.id }, { result: data }),
              [this.identity.toString('hex'), this.contact],
              contact.payload.params
            ])
          },
          error: (msg, code = -32000) => {
            this.rpc.serializer.write([
              merge({ id: message.payload.id }, {
                error: { message: msg, code }
              }),
              [this.identity.toString('hex'), this.contact],
              contact.payload.params
            ])
          }
        }
      );
    }

    // NB: If we aren't expecting this message, just throw it away
    if (!this._pending.has(message.payload.id)) {
      return this.logger.warn(
        `received late or invalid response from ${contact.payload.params[0]}`
      );
    }

    // NB: Otherwise, check if we are waiting on a response to a pending
    // NB: message and fire the result handler
    const { handler } = this._pending.get(message.payload.id);
    const handlerArgs = [
      (message.type === 'error'
        ? new Error(message.payload.error.message)
        : null),
      (message.type === 'success'
        ? message.payload.result
        : null)
    ];

    handler(...handlerArgs);
    this._pending.delete(message.payload.id);
  }

  /**
   * Enumerates all pending handlers and fires them with a timeout error if
   * they have been pending too long
   * @private
   */
  _timeout() {
    let now = Date.now();
    let err = new Error('Timed out waiting for response');

    err.type = 'TIMEOUT';

    for (let [id, entry] of this._pending.entries()) {
      if (entry.timestamp + constants.T_RESPONSETIMEOUT >= now) {
        continue;
      }

      entry.handler(err);
      this._pending.delete(id);
    }
  }

  /**
   * Adds the given contact to the routing table
   * @private
   */
  _updateContact(identity, contact) {
    if (identity === this.identity.toString('hex')) {
      return null;
    } else {
      return this.router.addContactByNodeId(identity, contact);
    }
  }

  /**
   * Sends the [method, params] to the contact and executes the handler on
   * response or timeout
   * @param {string} method - RPC method name
   * @param {object|array} params - RPC parameters
   * @param {Bucket~contact} contact - Destination address information
   * @param {AbstractNode~sendCallback} [callback]
   */
  send(method, params, target, handler = () => null) {
    const { router } = this;
    const id = uuid();
    const timestamp = Date.now();

    if (!target || typeof target[0] !== 'string') {
      return handler(new Error('Refusing to send message to invalid contact'));
    }

    function wrapped(err) {
      if (err && err.type === 'TIMEOUT' && typeof target[0] === 'string') {
        router.removeContactByNodeId(target[0]);
      }

      handler(...arguments);
    }

    this._pending.set(id, { handler: wrapped, timestamp });
    this.rpc.serializer.write([
      { id, method, params },
      [this.identity.toString('hex'), this.contact],
      target
    ]);
  }
  /**
   * @callback AbstractNode~sendCallback
   * @param {null|error} error
   * @param {object|array|string|number} result
   */

  /**
   * Accepts an arbitrary function that receives this node as context
   * for mounting protocol handlers and extending the node with other
   * methods
   * @param {function} plugin - {@tutorial plugins}
   */
  plugin(func) {
    assert(typeof func === 'function', 'Invalid plugin supplied');
    return func(this);
  }

  /**
   * Mounts a message handler route for processing incoming RPC messages
   * @param {string} [method] - RPC method name to route through
   * @param {AbstractNode~middleware} middleware
   */
  use(method, middleware) {
    if (typeof method === 'function') {
      middleware = method;
      method = '*';
    }

    // NB: If middleware function takes 4 arguments, it is an error handler
    const type = middleware.length === 4 ? '_errors' : '_middlewares';
    const stack = this[type][method] = this[type][method] || [];

    stack.push(middleware);
  }
  /**
   * @callback AbstractNode~middleware
   * @param {error} [error] - Error object resulting from a middleware
   * @param {AbstractNode~request} request - The incoming message object
   * @param {AbstractNode~response} response - The outgoing response object
   * @param {AbstractNode~next} next - Call to proceed to next middleware
   */

  /**
   * Passes through to the {@link AbstractNode~transport}
   */
  listen() {
    let handlers = new ErrorRules(this);

    this.use(handlers.methodNotFound.bind(handlers));
    this.use(handlers.internalError.bind(handlers));

    this.transport.listen(...arguments);
  }

  /**
   * Processes a the given arguments by sending them through the appropriate
   * middleware stack
   * @param {AbstractNode~request} request
   * @param {AbstractNode~response} response
   */
  receive(request, response) {
    const self = this;
    const { method } = request;

    // NB: First pass the the arguments through the * middleware stack
    // NB: Then pass the arguments through the METHOD middleware stack
    function processRequest(callback) {
      async.series([
        (next) => self._middleware('*', [request, response], next),
        (next) => self._middleware(method, [request, response], next)
      ], callback)
    }

    // NB: Repeat the same steps for the error stack
    function handleErrors(err) {
      async.series([
        (next) => self._error('*', [err, request, response], next),
        (next) => self._error(method, [err, request, response], next)
      ]);
    }

    processRequest(handleErrors);
  }

  /**
   * Send the arguments through the stack type
   * @private
   */
  _stack(type, method, args, callback) {
    async.eachSeries(this[type][method] || [], (middleware, done) => {
      try {
        middleware(...args, done);
      } catch (err) {
        done(err);
      }
    }, callback);
  }

  /**
   * Send the arguments through the middleware
   * @private
   */
  _middleware() {
    this._stack('_middlewares', ...arguments);
  }

  /**
   * Send the arguments through the error handlers
   * @private
   */
  _error() {
    this._stack('_errors', ...arguments);
  }

}

module.exports = AbstractNode;
