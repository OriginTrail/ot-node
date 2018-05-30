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
     * @param query
     * @param totalTime
     * @returns {Promise<void>}
     */
    async queryNetwork(query, totalTime = 60000) {
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
            query: JSON.stringify(query),
            timestamp: Date.now(),
        });

        const dataLocationRequestObject = {
            message: {
                id: networkQueryModel.dataValues.id,
                wallet: this.config.node_wallet,
                nodeId: this.config.identity,
                query,
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
                }

                resolve(lowestOffer);
            }, totalTime);
        });
    }

    async handleReadOffer(offer) {
        /*
            dataReadRequestObject = {
            message: {
                wallet: DV_WALLET,
                nodeId: KAD_ID
                agreedPrice: …,
                imports: [
                    {sender_id: …,
                     importId: …
                          }, …
                        ],
                dataPrice: TOKEN_AMOUNT,
                stakeFactor: X
            },
            messageSignature: {
                c: …,
                r: …,
                s: …
            }
            }
         */
        const message = {
            wallet: this.config.wallet,
            nodeId: this.config.identity,
            agreedPrice: offer.data_price,
            imports: offer.imports,
            stakeFactor: offer.stakeFactor,
        };

        const dataReadRequestObject = {
            message,
            messageSignature: Utilities.generateRsvSignature(
                JSON.stringify(message),
                this.web3,
                this.config.node_private_key,
            ),
        };

        this.network.kademlia().dataReadRequest(
            dataReadRequestObject,
            offer.nodeId,
        );
    }

    async handleDataLocationResponse(message) {
        const queryId = message.id;

        // Find the query.
        const networkQuery = await Models.network_queries.findOne({
            where: { id: queryId },
        });

        if (!networkQuery) {
            throw Error(`Didn't find query with ID ${queryId}.`);
        }

        // Store the offer.
        const networkQueryResponse = await Models.network_query_responses.create({
            query: JSON.stringify(message.query),
            query_id: queryId,
            wallet: message.wallet,
            node_id: message.nodeId,
            imports: JSON.stringify(message.imports),
            data_size: message.dataSize,
            data_price: message.dataPrice,
            stake_factor: message.stakeFactor,
        });

        if (!networkQueryResponse) {
            log.error(`Failed to add query response. ${message}.`);
            throw Error('Internal error.');
        }
    }

    async handleDataReadRequest(message) {
        /*
        message: {
            id: ID,
            wallet: DH_WALLET,
            nodeId: KAD_ID,
            imports: [
                         importId: …
                    ],
            dataSize: DATA_BYTE_SIZE,
            stakeFactor: X
        }
        */

        // TODO: data read request should have own ID created by DH when placed the offer.

        // TODO: Initiate sending here. Do not wait.
    }
}

module.exports = DVService;
