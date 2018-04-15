/**
 * @module kadence/hibernate
 */

'use strict';

const { EventEmitter } = require('events');
const { Transform } = require('stream');
const merge = require('merge');
const bytes = require('bytes');
const ms = require('ms');


/**
 * Represents a bandwidth meter which will trigger hibernation
 */
class HibernatePlugin extends EventEmitter {

  static get DEFAULTS() {
    return {
      limit: '5gb',
      interval: '1d',
      reject: ['STORE', 'FIND_VALUE']
    };
  }

  /**
   * @constructor
   * @param {KademliaNode} node
   * @param {object} [options]
   * @param {string} [options.limit=5gb] - The accounting max bandwidth
   * @param {string} [options.interval=1d] - The accounting reset interval
   * @param {string[]} [options.reject] - List of methods to reject during
   * hibernation
   */
  constructor(node, options) {
    super();

    this.node = node;
    this.opts = merge(HibernatePlugin.DEFAULTS, options);
    this.limit = bytes(this.opts.limit);
    this.interval = ms(this.opts.interval);
    this.reject = this.opts.reject;

    this.node.rpc.deserializer.prepend(this.meter('inbound'));
    this.node.rpc.serializer.append(this.meter('outbound'));
    this.node.use((req, res, next) => this.detect(req, res, next));
    this.start();
  }


  /**
   * @property {boolean} hibernating - Indicates if our limits are reached
   */
  get hibernating() {
    return this.accounting.total >= this.limit;
  }

  /**
   * Starts the accounting reset timeout
   */
  start() {
    const now = Date.now();

    if (this.accounting) {
      this.emit('reset', merge({}, this.accounting, {
        hibernating: this.hibernating
      }));
    } else {
      this.emit('start');
    }

    this.accounting = {
      start: now,
      end: now + this.interval,
      inbound: 0,
      outbound: 0,
      unknown: 0,
      get total() {
        return this.inbound + this.outbound + this.unknown;
      },
      get reset() {
        return this.end - Date.now();
      }
    };

    setTimeout(() => this.start(), this.interval);
  }

  /**
   * Return a meter stream that increments the given accounting property
   * @param {string} type - ['inbound', 'outbound', 'unknown']
   * @returns {stream.Transform}
   */
  meter(type) {
    if (!['inbound', 'outbound'].includes(type)) {
      type = 'unknown';
    }

    const inc = (data) => {
      if (Buffer.isBuffer(data)) {
        this.accounting[type] += data.length;
      } else if (Array.isArray(data)) {
        this.accounting[type] += data[1].length;
      } else {
        this.accounting[type] = Buffer.from(data).length;
      }
    }

    return new Transform({
      transform: (data, enc, callback) => {
        inc(data);
        callback(null, data);
      },
      objectMode: true
    });
  }

  /**
   * Check if hibernating when messages received
   * @param {AbstractNode~request} request
   * @param {AbstractNode~response} response
   * @param {AbstractNode~next} next
   */
  detect(request, response, next) {
    if (this.hibernating && this.reject.includes(request.method)) {
      next(new Error(`Hibernating, try ${request.method} again later`));
    } else {
      next();
    }
  }

}

/**
 * Regsiters a {@link HibernatePlugin} with an {@link AbstractNode}
 * @param {object} [options]
 * @param {string} [options.limit=5gb] - The accounting max bandwidth
 * @param {string} [options.interval=1d] - The accounting reset interval
 * @param {string[]} [options.reject] - List of methods to reject during
 * hibernation
 */
module.exports = function(options) {
  return function(node) {
    return new module.exports.HibernatePlugin(node, options);
  };
};

module.exports.HibernatePlugin = HibernatePlugin;
