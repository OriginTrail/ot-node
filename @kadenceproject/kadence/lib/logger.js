/**
 * @module kadence/logger
 */

'use strict';

const { Transform } = require('stream');


/**
 * Logs all incoming messages
 */
class IncomingMessageLogger extends Transform {

  /**
   * @constructor
   * @param {AbstractNode~logger} logger - Logger to use
   */
  constructor(logger) {
    super({ objectMode: true });
    this.logger = logger;
  }

  /**
   * @private
   */
  _transform(data, enc, callback) {
    let [rpc, ident] = data;

    if (!ident.payload.params[0] || !ident.payload.params[1]) {
      return callback();
    }

    if (rpc.payload.method) {
      this.logger.info(
        `received ${rpc.payload.method} (${rpc.payload.id}) from ` +
        `${ident.payload.params[0]} ` +
        `(http://${ident.payload.params[1].hostname}:` +
        `${ident.payload.params[1].port})`
      );
    } else {
      this.logger.info(
        `received response from ${ident.payload.params[0]} to ` +
        `${rpc.payload.id}`
      );
    }

    callback(null, data);
  }

}

/**
 * Logs all outgoing messages
 */
class OutgoingMessageLogger extends Transform {

  /**
   * @constructor
   * @param {AbstractNode~logger} logger - Logger to use
   */
  constructor(logger) {
    super({ objectMode: true });
    this.logger = logger;
  }

  /**
   * @private
   */
  _transform(data, enc, callback) {
    let [rpc,, recv] = data;

    if (!recv[0] || !recv[1]) {
      return callback();
    }

    if (rpc.method) {
      this.logger.info(
        `sending ${rpc.method} (${rpc.id}) to ${recv[0]} ` +
        `(http://${recv[1].hostname}:${recv[1].port})`
      );
    } else {
      this.logger.info(
        `sending response to ${recv[0]} for ${rpc.id}`
      );
    }

    callback(null, data);
  }

}

module.exports = {
  IncomingMessage: IncomingMessageLogger,
  OutgoingMessage: OutgoingMessageLogger
};
