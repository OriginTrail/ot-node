/**
 * @module kadence/logger
 */

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

        if (rpc.payload.method && rpc.payload.method.includes('kad-')) {
            this.logger.api(
                `received ${rpc.payload.method} (${rpc.payload.id}) from ` +
                `${ident.payload.params[0]} ` +
                `(${ident.payload.params[1].hostname}:` +
                `${ident.payload.params[1].port})`,
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

        if (rpc.method && rpc.method.includes('kad-')) {
            this.logger.api(
                `sending ${rpc.method} (${rpc.id}) to ${recv[0]} ` +
                `(${recv[1].hostname}:${recv[1].port})`,
            );
        }

        callback(null, data);
    }

}

module.exports = {
    IncomingMessage: IncomingMessageLogger,
    OutgoingMessage: OutgoingMessageLogger,
};
