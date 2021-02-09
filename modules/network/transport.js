const retry = require('async-retry');

const DEFAULT_NETWORK_TYPE = 'kademlia';

/**
 * Default retry strategy
 */
const DEFAULT_RETRY_CONFIG = {
    retries: 5,
    factor: 1,
    minTimeout: 1000,
    maxTimeout: 40 * 1000,
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
        this.config = ctx.config;
        this.networkType = ctx.config.network_type ? ctx.config.network_type : DEFAULT_NETWORK_TYPE;
        switch (this.networkType) {
        case 'kademlia':
            this.network = ctx.kademlia;
            break;
        case 'http':
            this.network = ctx.httpNetwork;
            break;
        default:
            throw new Error(`Failed to construct network transport. Network type '${this.networkType}' is invalid.`);
        }
        await this.network.initialize();
    }

    /**
     * Starts the transport
     * @return {Promise<void>}
     */
    async start() {
        await this.network.start();
    }

    /**
     * Join node
     * @param request
     * @returns {*}
     */
    join(request) {
        return this.network.join(request);
    }


    /**
     * Dump network info
     * @return {*}
     */
    dumpNetworkInfo() {
        return this.network.dumpNetworkInfo();
    }

    /**
     * Extracts message from native request
     * @param request
     * @returns {*}
     */
    extractMessage(request) {
        return this.network.extractMessage(request);
    }

    /**
     * Extracts sender identity from native request
     * @param request
     * @returns {*}
     */
    extractSenderID(request) {
        return this.network.extractSenderID(request);
    }

    /**
     * Extracts sender information from native request
     * @param request
     * @returns {*}
     */
    extractSenderInfo(request) {
        return this.network.extractSenderInfo(request);
    }

    /**
     * Extracts status from native request
     * @param request
     * @returns {*}
     */
    extractRequestStatus(request) {
        return this.network.extractRequestStatus(request);
    }

    /**
     * Extracts status from native response
     * @param request
     * @returns {*}
     */
    extractResponseStatus(request) {
        return this.network.extractResponseStatus(request);
    }

    /**
     * Sends response
     * @param data
     * @param response
     * @returns {Promise<void>}
     */
    async sendResponse(response, data) {
        await this.network.sendResponse(response, data);
    }

    /**
     * Pass function call to the underlying network layer
     *
     * @param fn            Function to be called
     * @param msg           Message to be sent
     * @param contactId     ID of a contact
     * @param opts          Retry options
     * @param fatalErrors   Halt execution on fatal errors
     * @private
     */
    _callNative(fn, msg, contactId, fatalErrors = [], opts = DEFAULT_RETRY_CONFIG) {
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
        return retry(async (halt, iteration) => {
            try {
                if (iteration > 1) {
                    this.logger.warn(`Retrying previous ${fn} operation. Contact ${contactId}, ${(opts.retries - iteration) + 1} left.`);
                }
                return await this.network.node[fn](msg, contactId);
            } catch (err) {
                const isFatal = fatalErrors.filter(e => err.msg.includes(e)).length > 0;
                if (isFatal) {
                    this.logger.warn(`No retry policy for the error ${err}`);
                    halt(err);
                    return;
                }
                this.logger.debug(`Calling ${fn} operation failed at ${iteration} iteration. Contact ${contactId}, ${err}.}`);
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

    /**
     * Dumps all peers
     * @returns {Promise<*>}
     */
    dumpContacts() {
        return this.network.dumpContacts();
    }

    async findNode(nodeId) {
        return this.network.findNode(nodeId);
    }

    async getContact(contactId) {
        return this.network.node.getContact(contactId);
    }
}

/**
 * Creates simple proxy to handle missing properties (pass them beneath)
 * @returns {Transport}
 */
const proxy = () => new Proxy(new Transport(), {
    get(target, propKey) {
        const property = target[propKey];
        if (!property) {
            // the property is missing
            // try to pass to the underlying network layer
            return target._callNative(propKey);
        }
        return target[propKey];
    },
});

module.exports = proxy;
