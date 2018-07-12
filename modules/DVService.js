const BN = require('bn.js');
const ethAbi = require('ethereumjs-abi');

const Utilities = require('./Utilities');
const Models = require('../models');
const ImportUtilities = require('./ImportUtilities');
const Encryption = require('./Encryption');

/**
 * DV operations (querying network, etc.)
 */
class DVService {
    /**
     * Default constructor
     * @param ctx IoC context
     */
    constructor({
        network, blockchain, web3, config, graphStorage, importer, logger, remoteControl
    }) {
        this.network = network;
        this.blockchain = blockchain;
        this.web3 = web3;
        this.config = config;
        this.graphStorage = graphStorage;
        this.importer = importer;
        this.log = logger;
        this.remoteControl = remoteControl;
    }

    /**
     * Sends query to the network
     * @param query
     * @returns {Promise<void>}
     */
    async queryNetwork(query) {
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
            'kad-data-location-request',
            dataLocationRequestObject,
            {},
            async () => {
                this.log.info(`Published query to the network. Query ID ${networkQueryModel.id}.`);
            },
        );

        return networkQueryModel.id;
    }

    /**
     * Handles network queries and chose lowest offer.
     * @param queryId
     * @param totalTime
     * @returns {Promise} Lowest offer. May be null.
     */
    handleQuery(queryId, totalTime = 60000) {
        return new Promise((resolve, reject) => {
            setTimeout(async () => {
                // Check for all offers.
                const responseModels = await Models.network_query_responses.findAll({
                    where: { query_id: queryId },
                });

                this.log.trace(`Finalizing query ID ${queryId}. Got ${responseModels.length} offer(s).`);

                let lowestOffer = null;
                responseModels.forEach((response) => {
                    const price = new BN(response.data_price, 10);
                    if (lowestOffer == null || price.lt(new BN(lowestOffer.data_price, 10))) {
                        lowestOffer = response.get({ plain: true });
                    }
                });

                const networkQuery = await Models.network_queries.find({ where: { id: queryId } });

                if (!lowestOffer) {
                    this.log.info('Didn\'t find answer or no one replied.');
                    networkQuery.status = 'FINISHED';
                    await networkQuery.save({ fields: ['status'] });
                } else {
                    // Finish auction.
                    networkQuery.status = 'PROCESSING';
                    await networkQuery.save({ fields: ['status'] });
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

        await this.network.kademlia().dataReadRequest(
            dataReadRequestObject,
            offer.node_id,
            (err) => {
                if (err) {
                    this.log.warn(`Data request failed for reply_id ${message.id}. ${err}`);
                } else {
                    this.log.info(`Data request sent for reply_id ${message.id}.`);
                }
            },
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

        if (networkQuery.status !== 'OPEN') {
            throw Error('Too late. Query closed.');
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

        // TODO: Fire socket notification for Houston

        if (!networkQueryResponse) {
            this.log.error(`Failed to add query response. ${message}.`);
            throw Error('Internal error.');
        }

        this.remoteControl.networkQueryOfferArrived({
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
    }

    async handleDataReadResponse(message) {
        /*
            message: {
                id: REPLY_ID
                wallet: DH_WALLET,
                nodeId: KAD_ID
                agreementStatus: CONFIRMED/REJECTED,
                encryptedData: { … }
                importId: IMPORT_ID,        // Temporal. Remove it.
            },
         */

        // Is it the chosen one?
        const replyId = message.id;

        // Find the particular reply.
        const networkQueryResponse = await Models.network_query_responses.findOne({
            where: { reply_id: replyId },
        });

        if (!networkQueryResponse) {
            throw Error(`Didn't find query reply with ID ${replyId}.`);
        }

        const networkQuery = await Models.network_queries.findOne({
            where: { id: networkQueryResponse.query_id },
        });

        if (message.agreementStatus !== 'CONFIRMED') {
            networkQuery.status = 'REJECTED';
            await networkQuery.save({ fields: ['status'] });
            throw Error('Read not confirmed');
        }

        const importId = JSON.parse(networkQueryResponse.imports)[0];

        // Calculate root hash and check is it the same on the SC.
        const { data_provider_wallet } = message;
        const { vertices, edges } = message.encryptedData;
        const dhWallet = message.wallet;

        const escrow = await this.blockchain.getEscrow(importId, message.wallet);

        if (!escrow) {
            const errorMessage = `Couldn't not find escrow for DH ${dhWallet} and import ID ${importId}`;
            this.log.warn(errorMessage);
            networkQuery.status = 'FAILED';
            await networkQuery.save({ fields: ['status'] });
            throw errorMessage;
        }

        // Poor mans choice to check if escrow is ok.
        if (escrow.escrow_status === 0) {
            const errorMessage = `Couldn't not find escrow for DH ${dhWallet} and import ID ${importId}`;
            this.log.warn(errorMessage);
            networkQuery.status = 'FAILED';
            await networkQuery.save({ fields: ['status'] });
            throw errorMessage;
        }

        const merkle = await ImportUtilities.merkleStructure(vertices.filter(vertex =>
            vertex.vertex_type !== 'CLASS'), edges);
        const rootHash = merkle.tree.getRoot();

        if (escrow.distribution_root_hash !== rootHash) {
            const errorMessage = `Distribution root hash doesn't match one in escrow. Root hash ${rootHash}, first DH ${dhWallet}, import ID ${importId}`;
            this.log.warn(errorMessage);
            networkQuery.status = 'FAILED';
            await networkQuery.save({ fields: ['status'] });
            throw errorMessage;
        }

        try {
            await this.importer.importJSON({
                vertices: message.encryptedData.vertices,
                edges: message.encryptedData.edges,
                import_id: importId,
                wallet: data_provider_wallet,
            }, true);
        } catch (error) {
            this.log.warn(`Failed to import JSON. ${error}.`);
            networkQuery.status = 'FAILED';
            await networkQuery.save({ fields: ['status'] });
            return;
        }

        this.log.info(`Import ID ${importId} imported successfully.`);

        Models.data_info.create({
            import_id: importId,
            total_documents: vertices.length,
            root_hash: rootHash,
            data_provider_wallet,
            import_timestamp: new Date(),
        });

        // Check if enough tokens. From smart contract:
        // require(DH_balance > stake_amount && DV_balance > token_amount.add(stake_amount));
        const stakeAmount =
            new BN(networkQueryResponse.data_price).mul(new BN(networkQueryResponse.stake_factor));

        // Check for DH first.
        const dhBalance =
            new BN((await this.blockchain.getProfile(networkQueryResponse.wallet)).balance, 10);

        if (dhBalance.lt(stakeAmount)) {
            const errorMessage = `DH doesn't have enough tokens to sign purchase. Required ${stakeAmount.toString()}, have ${dhBalance.toString()}`;
            this.log.warn(errorMessage);
            throw errorMessage;
        }

        // Check for balance.
        const profileBalance =
            new BN((await this.blockchain.getProfile(this.config.node_wallet)).balance, 10);
        const condition = new BN(networkQueryResponse.data_price)
            .add(stakeAmount);

        if (profileBalance.lt(condition)) {
            await this.blockchain.increaseBiddingApproval(condition.sub(profileBalance));
            await this.blockchain.depositToken(condition.sub(profileBalance));
        }

        // Sign escrow.
        this.log.notify(`Initiating purchase for import ${importId}`);
        await this.blockchain.initiatePurchase(
            importId,
            dhWallet,
            new BN(networkQueryResponse.data_price),
            new BN(networkQueryResponse.stake_factor),
        );

        this.log.important(`[DV] - Purchase initiated for import ID ${importId}.`);

        // Wait for event from blockchain.
        // event: CommitmentSent(import_id, msg.sender, DV_wallet);
        // await this.blockchain.subscribeToEvent('CommitmentSent', importId, 20 * 60 * 1000);
        this.blockchain.subscribeToEvent('CommitmentSent', importId, 10 * 60 * 1000).then(async (eventData) => {
            if (!eventData) {
                // Everything is ok.
                this.log.warn(`Commitment not sent for purchase ${importId}. Canceling it.`);
                await this.blockchain.cancelPurchase(importId, dhWallet, false);
                networkQuery.status = 'CANCELED';
                await networkQuery.save({ fields: ['status'] });
                this.log.info(`Purchase for import ${importId} canceled.`);
            }
        });
    }

    async handleEncryptedPaddedKey(message) {
        /*
            message: {
                id,
                wallet,
                nodeId,
                m1,
                m2,
                e,
                r1,
                r2,
                sd, // epkChecksum
                blockNumber,
            }
         */

        const {
            id, wallet, nodeId, m1, m2, e, r1, r2, sd, blockNumber,
        } = message;

        // Check if mine request.

        // Find the particular reply.
        const networkQueryResponse = await Models.network_query_responses.findOne({
            where: { reply_id: id },
        });

        if (!networkQueryResponse) {
            throw Error(`Didn't find query reply with ID ${id}.`);
        }

        const networkQuery = await Models.network_queries.findOne({
            where: { id: networkQueryResponse.query_id },
        });

        const importId = JSON.parse(networkQueryResponse.imports)[0];

        const m1Checksum = Utilities.normalizeHex(Encryption.calculateDataChecksum(m1, r1, r2));
        const m2Checksum =
            Utilities.normalizeHex(Encryption.calculateDataChecksum(m2, r1, r2, blockNumber + 1));
        const epkChecksumHash =
            Utilities.normalizeHex(ethAbi.soliditySHA3(
                ['uint256'],
                [sd],
            ).toString('hex'));

        // Get checksum from blockchain.
        const purchaseData = await this.blockchain.getPurchasedData(importId, wallet);

        let testNumber = new BN(purchaseData.checksum, 10);
        const r1Bn = new BN(r1);
        const r2Bn = new BN(r2);
        testNumber = testNumber.add(r2Bn).add(r1Bn.mul(new BN(128)));

        if (!testNumber.eq(new BN(Utilities.denormalizeHex(sd), 16))) {
            this.log.warn(`Commitment test failed for reply ID ${id}. Node wallet ${wallet}, import ID ${importId}.`);
            if (await this._litigatePurchase(importId, wallet, nodeId, m1, m2, e)) {
                networkQuery.status = 'FINISHED';
                await networkQuery.save({ fields: ['status'] });
            } else {
                networkQuery.status = 'FAILED';
                await networkQuery.save({ fields: ['status'] });
            }
            throw Error('Commitment test failed.');
        }

        const commitmentHash = Utilities.normalizeHex(ethAbi.soliditySHA3(
            ['uint256', 'uint256', 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256'],
            [m1Checksum, m2Checksum, epkChecksumHash, r1, r2, e, blockNumber],
        ).toString('hex'));

        const blockchainCommitmentHash =
            (await this.blockchain.getPurchase(wallet, this.config.node_wallet, importId))
                .commitment;

        if (commitmentHash !== blockchainCommitmentHash) {
            const errorMessage = `Blockchain commitment hash ${blockchainCommitmentHash} differs from mine ${commitmentHash}.`;
            this.log.warn(errorMessage);
            if (await this._litigatePurchase(importId, wallet, nodeId, m1, m2, e)) {
                networkQuery.status = 'FINISHED';
                await networkQuery.save({ fields: ['status'] });
            } else {
                networkQuery.status = 'FAILED';
                await networkQuery.save({ fields: ['status'] });
            }
            throw Error(errorMessage);
        }

        await this.blockchain.confirmPurchase(importId, wallet);

        const encryptedBlockEvent =
            await this.blockchain.subscribeToEvent('EncryptedBlockSent', importId, 60 * 60 * 1000);

        if (encryptedBlockEvent) {
            // DH signed the escrow. Yay!
            const purchase =
                await this.blockchain.getPurchase(wallet, this.config.node_wallet, importId);
            const epk = m1 +
                Buffer.from(
                    Encryption.xor(
                        Utilities.expandHex(new BN(purchase.encrypted_block).toString('hex'), 64),
                        Utilities.denormalizeHex(e),
                    ),
                    'hex',
                ).toString('ascii') + m2;

            try {
                const publicKey = Encryption.unpackEPK(epk);
                await Models.holding_data.create({
                    id: importId,
                    source_wallet: wallet,
                    data_public_key: publicKey,
                    distribution_public_key: publicKey,
                    epk,
                });
                networkQuery.status = 'FINISHED';
                await networkQuery.save({ fields: ['status'] });
            } catch (err) {
                this.log.warn(`Invalid purchase decryption key, Reply ID ${id}, wallet ${wallet}, import ID ${importId}.`);
                if (await this._litigatePurchase(importId, wallet, nodeId, m1, m2, e)) {
                    networkQuery.status = 'FINISHED';
                    await networkQuery.save({ fields: ['status'] });
                } else {
                    networkQuery.status = 'FAILED';
                    await networkQuery.save({ fields: ['status'] });
                }
                return;
            }

            this.log.info(`[DV] Purchase ${importId} finished. Got key.`);
            this.remoteControl.purchaseFinished(`[DV] Purchase ${importId} finished. Got key.`, importId);
        } else {
            // Didn't sign escrow. Cancel it.
            this.log.info(`DH didn't sign the escrow. Canceling it. Reply ID ${id}, wallet ${wallet}, import ID ${importId}.`);
            await this.blockchain.cancelPurchase(importId, wallet, false);
            networkQuery.status = 'FAILED';
            await networkQuery.save({ fields: ['status'] });
            this.log.info(`Purchase for import ID ${importId} canceled.`);
        }
    }

    async _litigatePurchase(importId, wallet, nodeId, m1, m2, e) {
        // Initiate despute here.
        await this.blockchain.initiateDispute(importId, wallet);

        // Wait for event.
        // emit PurchaseDisputeCompleted(import_id, msg.sender, DV_wallet, true);

        const purchaseDisputeCompleted =
            await this.blockchain.subscribeToEvent('PurchaseDisputeCompleted', importId, 60 * 60 * 1000);

        if (purchaseDisputeCompleted.proof_was_correct) {
            // Ups, should never happened.
            this.log.warn(`Contract claims litigation was unfortunate for me. Import ID ${importId}`);

            // Proceed like nothing happened.
            const purchase =
                await this.blockchain.getPurchase(wallet, this.config.node_wallet, importId);
            const epk = m1 + Encryption.xor(purchase.encrypted_block, e) + m2;
            const publicKey = Encryption.unpackEPK(epk);

            await Models.holding_data.create({
                id: importId,
                source_wallet: wallet,
                data_public_key: publicKey,
                distribution_public_key: publicKey,
                epk,
            });

            return false;
        }

        this.log.warn(`Contract claims litigation was fortunate for me. Import ID ${importId}`);
        return true;
    }
}

module.exports = DVService;
