const Utilities = require('./Utilities');
const Models = require('../models');
const BN = require('bn.js');
const ImportUtilities = require('./ImportUtilities');

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
        network, blockchain, web3, config, graphStorage, importer,
    }) {
        this.network = network;
        this.blockchain = blockchain;
        this.web3 = web3;
        this.config = config;
        this.graphStorage = graphStorage;
        this.importer = importer;
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
                    query: [
                              {
                                path: _path,
                                value: _value,
                                opcode: OPCODE
                              },
                              ...
                    ]
                }
                messageSignature: {
                    v: …,
                    r: …,
                    s: …
                }
             }
         */

        const networkQueryModel = await Models.network_queries.create({ query });

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
                log.info(`Published query to the network. Query ID ${networkQueryModel.id}.`);
            },
        );

        return new Promise((resolve, reject) => {
            setTimeout(async () => {
                // Check for all offers.
                const responseModels = await Models.network_query_responses.findAll({
                    where: { query_id: networkQueryModel.id },
                });

                log.trace(`Finalizing query ID ${networkQueryModel.id}. Got ${responseModels.length} offer(s).`);

                // TODO: Get some choose logic here.
                let lowestOffer;
                responseModels.forEach((response) => {
                    const price = new BN(response.data_price, 10);
                    if (lowestOffer === undefined || price.lt(new BN(lowestOffer.data_price, 10))) {
                        lowestOffer = response.get({ plain: true });
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
                id: REPLY_ID
                wallet: DV_WALLET,
                nodeId: KAD_ID,
            },
            messageSignature: {
                c: …,
                r: …,
                s: …
            }
            }
         */
        const message = {
            id: offer.reply_id,
            wallet: this.config.node_wallet,
            nodeId: this.config.identity,
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
            offer.node_id,
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
            reply_id: message.replyId,
        });

        if (!networkQueryResponse) {
            log.error(`Failed to add query response. ${message}.`);
            throw Error('Internal error.');
        }
    }

    async handleDataReadResponse(message) {
        /*
            message: {
                id: REPLY_ID
                wallet: DH_WALLET,
                nodeId: KAD_ID
                agreementStatus: CONFIRMED/REJECTED,
                purchaseId: PURCHASE_ID,
                encryptedData: { … }
                importId: IMPORT_ID,        // Temporal. Remove it.
            },
         */
        if (message.agreementStatus !== 'CONFIRMED') {
            throw Error('Read not confirmed');
        }

        // Is it the chosen one?
        const replyId = message.id;

        // Find the particular reply.
        const networkQueryResponse = await Models.network_query_responses.findOne({
            where: { id: replyId },
        });

        if (!networkQueryResponse) {
            throw Error(`Didn't find query reply with ID ${replyId}.`);
        }

        const importId = JSON.parse(networkQueryResponse.imports)[0];

        // Calculate root hash and check is it the same on the SC.
        const { vertices, edges } = message.encryptedData;
        const dhFirstDHWallet = vertices.filter(vertex => vertex.vertex_typ = 'CLASS')[0].dh_wallet; // TODO: every vertex should have this.

        const escrow = await this.blockchain.getEscrow(importId, dhFirstDHWallet);

        if (!escrow) {
            const errorMessage = `Couldn't not find escrow for DH ${dhFirstDHWallet} and import ID ${importId}`;
            log.warn(errorMessage);
            throw errorMessage;
        }

        const merkle = await ImportUtilities.merkleStructure(vertices, edges);
        const rootHash = merkle.tree.getRoot()

        if (escrow.distribution_root_hash !== rootHash) {
            const errorMessage = `Distribution root hash doesn't match one in escrow. Root hash ${rootHash}, first DH ${dhFirstDHWallet}, import ID ${importId}`;
            log.warn(errorMessage);
            throw errorMessage;
        }

        try {
            await this.importer.importJSON({
                vertices: message.encryptedData.vertices,
                edges: message.encryptedData.edges,
                import_id: importId,
            });
        } catch (error) {
            log.warn(`Failed to import JSON. ${error}.`);
            return;
        }

        log.info(`Import ID ${importId} imported successfully.`);

        // TODO: Maybe separate table is needed.
        Models.data_info.create({
            import_id: importId,
            total_documents: vertices.length,
            root_hash: rootHash,
            import_timestamp: new Date(),
        });

        // Check if enough tokens. From smart contract:
        // require(DH_balance > stake_amount && DV_balance > token_amount.add(stake_amount));
        const stakeAmount =
            new BN(networkQueryResponse.data_price)
                .mul(new BN(networkQueryResponse.stake_factor));
        // Check for DH first.
        const dhBalance =
            new BN((await this.blockchain.getProfile(networkQueryResponse.wallet)).balance, 10);

        if (dhBalance.lt(stakeAmount)) {
            const errorMessage = `DH doesn't have enough tokens to sign purchase. Required ${stakeAmount.toString()}, have ${dhBalance.toString()}`;
            log.warn(errorMessage);
            throw errorMessage;
        }

        // Check for balance.
        const profileBalance =
            new BN((await this.blockchain.getProfile(this.config.node_wallet)).balance, 10);
        const condition = new BN(networkQueryResponse.data_price)
            .add(stakeAmount).add(new BN(1)); // Thanks Cookie.

        if (profileBalance.lt(condition)) {
            await this.blockchain.increaseBiddingApproval(condition.sub(profileBalance));
            await this.blockchain.depositToken(condition.sub(profileBalance));
        }

        // Sign escrow.
        await this.blockchain.initiatePurchase(
            importId,
            this.config.node_wallet,
            new BN(networkQueryResponse.data_price),
            new BN(networkQueryResponse.stake_factor),
        );
    }
}

module.exports = DVService;
