const retry = require('async-retry');

const DEFAULT_NETWORK_TYPE = 'kademlia';

/**
 * Default retry strategy
 */
const DEFAULT_RETRY_CONFIG = {
    retries: 5,
    factor: 1,
    minTimeout: 1000,
    maxTimeout: 60 * 1000,
    randomize: true,
};

/**
 * Abstracts network transport
 */
class Transport {
    /**
     * Initializes underlying network transport
     * @returns {Promise<void>}
     */
    async init(ctx) {
        this.logger = ctx.logger;
        this.networkType = ctx.config.network_type ? ctx.config.network_type : DEFAULT_NETWORK_TYPE;
        switch (this.networkType) {
        case 'kademlia':
            this.network = ctx.network;
            break;
        default:
            throw new Error(`Failed to construct network transport. Network type '${this.networkType}' is invalid.`);
        }
        await this.network.initialize();
        await this.network.start();
    }

    /**
     * Wraps function call for the underlying network layer
     *
     * @param fn            Function to be called
     * @param msg           Message to be sent
     * @param contactId     ID of a contact
     * @param opts          Retry options
     * @param fatalErrors   Halt execution on fatal errors
     * @private
     */
    _wrap(fn, msg, contactId, fatalErrors = [], opts = DEFAULT_RETRY_CONFIG) {
        return async (msg, contactId, opts, fatalErrors) =>
            this._send(fn, msg, contactId, opts, fatalErrors);
    }

    /**
     * Sends single message to contact ID
     *
     * @param fn            Function to be called
     * @param msg           Message to be sent
     * @param contactId     ID of a contact
     * @param opts          Retry options
     * @param fatalErrors   Halt execution on fatal errors
     * @private
     */
    async _send(fn, msg, contactId, opts = DEFAULT_RETRY_CONFIG, fatalErrors = []) {
        await retry(async (halt) => {
            try {
                return await this.network.node[fn](msg, contactId);
            } catch (err) {
                const isFatal = fatalErrors.filter(e => err.msg.includes(e)).length > 0;
                if (isFatal) {
                    halt(err);
                    return;
                }
                throw err;
            }
        }, opts);
    }

    /**
     * Returns basic information about the network
     */
    async getNetworkInfo() {
        return this.network.getNetworkInfo();
    }
}

module.exports = () => new Proxy(new Transport(), {
    get(target, propKey) {
        const property = target[propKey];
        if (!property) {
            // the property is missing
            // try to pass to an underlying network layer
            return target._wrap(propKey);
        }
        return target[propKey];
    },
});
