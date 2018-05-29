const Utilities = require('./Utilities');
const Models = require('../models');

const log = Utilities.getLogger();

/**
 * DV operations (querying network, etc.)
 */
class DVService {
    /**
     * Default constructor
     * @param ctx IoC context
     */
    constructor({
        network, blockchain, web3, config,
    }) {
        this.network = network;
        this.blockchain = blockchain;
        this.web3 = web3;
        this.config = config;
    }

    /**
     * Sends query to the network
     * @param queryParams
     * @returns {Promise<void>}
     */
    async queryNetwork(queryParams) {
        /*
            Expected dataLocationRequestObject:
            dataLocationRequestObject = {
                message: {
                    id: ID,
                    wallet: DV_WALLET,
                    nodeId: KAD_ID
                    query: {
                              identifiers: { … }
                              data: { … }
                              senderId: { … }
                    }
                }
                messageSignature: {
                    v: …,
                    r: …,
                    s: …
                }
             }
         */

        const dataLocationRequestObject = {
            message: {
                id: 1,
                wallet: this.config.node_wallet,
                nodeId: this.config.identity,
                query: {
                    identifiers: { dummy: 'dummy' },
                    data: { id: 1234567890 },
                    senderId: { id: 'SENDER_PROVIDER_ID' },
                },
            },
        };

        dataLocationRequestObject.messageSignature =
            Utilities.generateRsvSignature(
                JSON.stringify(dataLocationRequestObject.message),
                this.web3,
                this.config.node_private_key,
            );

        this.network.kademlia().quasar.quasarPublish(
            'data-location-request',
            dataLocationRequestObject,
            {},
            async () => {
                const networkQuery = await Models.network_queries.create({
                    query: JSON.stringify(dataLocationRequestObject.message.query),
                    timestamp: Date.now(),
                });
                log.info(`Published query to the network. Query ID ${networkQuery.id}.`);
            },
        );
    }
}

module.exports = DVService;
