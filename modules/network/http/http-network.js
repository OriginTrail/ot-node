const fs = require('fs');
const request = require('request');
const crypto = require('crypto');

/**
 *  HTTP network transport used for testing purposes mostly
 */
class HttpNetwork {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
    }

    async initialize() {
        this.logger.trace('Network initialized');
        this.node = {};
        this.register = {};

        this.node.getContact = async contactId => (this.register[contactId]);

        this.node.replicationRequest = async (message, contactId) => {
            const data = {
                type: 'kad-replication-request',
                message,
            };
            const contact = await this.node.getContact(contactId);
            return HttpNetwork.send(contact.hostname, data, this.config.identity);
        };

        this.node.replicationData = async (message, contactId) => {
            const data = {
                type: 'kad-replication-data',
                message,
            };
            const contact = await this.node.getContact(contactId);
            return HttpNetwork.send(contact.hostname, data, this.config.identity);
        };

        this.node.replicationFinished = async (message, contactId) => {
            const data = {
                type: 'kad-replication-finished',
                message,
            };
            const contact = await this.node.getContact(contactId);
            return HttpNetwork.send(contact.hostname, data, this.config.identity);
        };

        this.node.challengeRequest = async (message, contactId) => {
            const data = {
                type: 'kad-challenge-request',
                message,
            };
            const contact = await this.node.getContact(contactId);
            return HttpNetwork.send(contact.hostname, data, this.config.identity);
        };

        this.node.sendDataLocationResponse = async (message, contactId) => {
            const data = {
                type: 'kad-data-location-response',
                message,
            };
            const contact = await this.node.getContact(contactId);
            return HttpNetwork.send(contact.hostname, data, this.config.identity);
        };

        this.node.dataReadRequest = async (message, contactId) => {
            const data = {
                type: 'kad-data-read-request',
                message,
            };
            const contact = await this.node.getContact(contactId);
            return HttpNetwork.send(contact.hostname, data, this.config.identity);
        };

        this.node.sendDataReadResponse = async (message, contactId) => {
            const data = {
                type: 'kad-data-read-response',
                message,
            };
            const contact = await this.node.getContact(contactId);
            return HttpNetwork.send(contact.hostname, data, this.config.identity);
        };

        this.node.sendPermissionedDataReadRequest = async (message, contactId) => {
            const data = {
                type: 'kad-permissioned-data-read-request',
                message,
            };
            const contact = await this.node.getContact(contactId);
            return HttpNetwork.send(contact.hostname, data, this.config.identity);
        };

        this.node.sendPermissionedDataReadResponse = async (message, contactId) => {
            const data = {
                type: 'kad-permissioned-data-read-response',
                message,
            };
            const contact = await this.node.getContact(contactId);
            return HttpNetwork.send(contact.hostname, data, this.config.identity);
        };

        this.node.sendDataPurchaseRequest = async (message, contactId) => {
            const data = {
                type: 'kad-data-purchase-request',
                message,
            };
            const contact = await this.node.getContact(contactId);
            return HttpNetwork.send(contact.hostname, data, this.config.identity);
        };

        this.node.sendDataPurchaseResponse = async (message, contactId) => {
            const data = {
                type: 'kad-data-purchase-response',
                message,
            };
            const contact = await this.node.getContact(contactId);
            return HttpNetwork.send(contact.hostname, data, this.config.identity);
        };

        this.node.sendEncryptedKey = async (message, contactId) => {
            const data = {
                type: 'kad-send-encrypted-key',
                message,
            };
            const contact = await this.node.getContact(contactId);
            return HttpNetwork.send(contact.hostname, data, this.config.identity);
        };

        this.node.sendEncryptedKeyProcessResult = async (message, contactId) => {
            const data = {
                type: 'kad-encrypted-key-process-result',
                message,
            };
            const contact = await this.node.getContact(contactId);
            return HttpNetwork.send(contact.hostname, data, this.config.identity);
        };

        this.node.sendPublicKeyRequest = async (message, contactId) => {
            const data = {
                type: 'kad-public-key-request',
                message,
            };
            const contact = await this.node.getContact(contactId);
            return HttpNetwork.send(contact.hostname, data, this.config.identity);
        };

        this.node.publish = async (topic, message, opts = {}) => new Promise((resolve, reject) => {
            // TODO
        });
    }

    async start() {
        if (!fs.existsSync(`${__dirname}/../../../keys/key`)) {
            this.config.identity = crypto.randomBytes(20).toString('hex');
            fs.writeFileSync(`${__dirname}/../../../keys/key`, this.config.identity);
        } else {
            this.config.identity = fs.readFileSync(`${__dirname}/../../../keys/key`).toString();
        }

        const hostname = 'http://localhost:8900/network/send'; // TODO remove hardcoded value
        this.register[this.config.identity] = {
            wallet: this.config.node_wallet,
            identity: this.config.identity,
            hostname,
        };

        // Cast network nodes to an array
        if (typeof this.config.network_bootstrap_nodes === 'string') {
            this.config.network_bootstrap_nodes =
                this.config.network_bootstrap_nodes.trim().split();
        }
        const bootstrapNodes = this.config.network_bootstrap_nodes;

        if (bootstrapNodes.length > 0) {
            // join
            const res = await HttpNetwork.send(bootstrapNodes[0], {
                type: 'kad-join',
                message: {
                    wallet: this.config.node_wallet,
                    identity: this.config.identity,
                    hostname,
                },
            });
            this.register = res.register;
        }

        this.logger.trace('Network started');
    }

    /**
     * Join node
     * @param request
     * @returns {*}
     */
    join(request) {
        const contact = request.body.message;
        this.register[contact.identity] = contact;
        return this.register;
    }

    /**
     * Extracts message from native request
     * @param request
     * @returns {*}
     */
    extractMessage(request) {
        return request.body.message;
    }

    /**
     * Extracts status from native request
     * @param request
     * @returns {*}
     */
    extractRequestStatus(request) {
        return request.status;
    }

    /**
     * Extracts status from native response
     * @param request
     * @returns {*}
     */
    extractResponseStatus(response) {
        return response.status;
    }

    /**
     * Extracts sender identity from native request
     * @param request
     * @returns {*}
     */
    extractSenderID(request) {
        return request.body.identity;
    }

    /**
     * Sends response
     * @param data
     * @param response
     * @returns {Promise<void>}
     */
    async sendResponse(response, data) {
        response.status(200);
        response.send(data);
    }

    /**
     * Extracts sender information from native request
     * @param request
     * @returns {*}
     */
    extractSenderInfo(request) {
        return this.register[request.body.identity];
    }

    static send(url, data, identity) {
        data.identity = identity;
        return new Promise((resolve, reject) => {
            request({
                url,
                method: 'POST',
                json: data,
            }, (error, response, body) => {
                if (!error && response.statusCode === 200) {
                    resolve(body);
                } else {
                    reject(error);
                }
            });
        });
    }
}

module.exports = HttpNetwork;
