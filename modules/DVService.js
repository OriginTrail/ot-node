const Utilities = require('./Utilities');
const Models = require('../models');
const BN = require('bn.js');

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
     * @param totalTime
     * @returns {Promise<void>}
     */
    async queryNetwork(queryParams, totalTime = 60000) {
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

        const networkQueryModel = await Models.network_queries.create({
            query: JSON.stringify(queryParams),
            timestamp: Date.now(),
        });

        const dataLocationRequestObject = {
            message: {
                id: networkQueryModel.dataValues.id,
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

        return new Promise((resolve, reject) => {
            setTimeout(async () => {
                // Check for all offers.
                const responseModels = await Models.network_query_responses.findAll({
                    where: { query_id: networkQueryModel.dataValues.id },
                });

                log.trace(`Finalizing query ID ${networkQueryModel.dataValues.id}. Got ${responseModels.length} offer(s).`);

                // TODO: Get some choose logic here.
                let lowestOffer;
                responseModels.forEach((response) => {
                    const price = new BN(response.data_price, 10);
                    if (lowestOffer === undefined || price.lt(new BN(lowestOffer.data_price, 10))) {
                        lowestOffer = response;
                    }
                });

                if (lowestOffer === undefined) {
                    log.info('Didn\'t find answer or no one replied.');
                    return;
                }

                // Start escrow from here.

                resolve(lowestOffer);
            }, totalTime);
        });
    }
}

module.exports = DVService;
