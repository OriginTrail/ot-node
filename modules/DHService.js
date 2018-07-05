const BN = require('bn.js');

const Utilities = require('./Utilities');
const Models = require('../models');
const Op = require('sequelize/lib/operators');
const Encryption = require('./Encryption');
const MerkleTree = require('./Merkle');
const Challenge = require('./Challenge');
const Graph = require('./Graph');
const ImportUtilities = require('./ImportUtilities');
const ethAbi = require('ethereumjs-abi');
const crypto = require('crypto');

/**
 * DH operations (handling new offers, etc.)
 */
class DHService {
    /**
     * Default constructor
     * @param ctx IoC context
     */
    constructor(ctx) {
        this.config = ctx.config;
        this.importer = ctx.importer;
        this.blockchain = ctx.blockchain;
        this.network = ctx.network;
        this.web3 = ctx.web3;
        this.graphStorage = ctx.graphStorage;
        this.log = ctx.logger;
    }

    /**
     * Handles new offer
     *
     */
    async handleOffer(
        importId,
        dcNodeId,
        totalEscrowTime,
        maxTokenAmount,
        minStakeAmount,
        minReputation,
        dataSizeBytes,
        dataHash,
        predeterminedBid,
    ) {
        try {
            // Check if mine offer and if so ignore it.
            const offerModel = await Models.offers.findOne({ where: { import_id: importId } });
            if (offerModel) {
                const offer = offerModel.get({ plain: true });
                this.log.trace(`Mine offer (ID ${offer.data_hash}). Offer ignored`);
                return;
            }

            dcNodeId = dcNodeId.substring(2, 42);
            const dcContact = await this.network.kademlia().getContact(dcNodeId, true);
            if (dcContact == null || dcContact.hostname == null) {
                this.log.warn(`Unknown DC contact ${dcNodeId} for import ${importId}. Offer ignored`);
                return;
            }

            const distanceParams = await this.blockchain.getDistanceParameters(importId);

            const nodeHash = distanceParams[0];
            const dataHash = distanceParams[1];
            const currentRanking = distanceParams[3]; // Not used at the moment
            const k = distanceParams[4];
            const numNodes = distanceParams[5];

            if (this.amIClose(k, numNodes, dataHash, nodeHash, 200000)) {
                this.log.notify('Close enough to take bid');
            } else {
                this.log.notify('Not close enough to take bid');
                return;
            }

            const dataInfo = await Models.data_info.findOne({
                where: { import_id: importId },
            });
            if (dataInfo) {
                this.log.trace(`I've already stored data for import ID ${importId}. Ignoring.`);
                return;
            }

            // Check if predetermined bid was already added for me.
            // Possible race condition here.
            if (!predeterminedBid) {
                // If event is in the table event will be handled on different call.
                const eventModels = await Models.events.findAll({
                    where: {
                        import_id: importId,
                        event: 'AddedPredeterminedBid',
                    },
                });

                if (eventModels) {
                    let found = false;
                    eventModels.forEach((eventModel) => {
                        const data = JSON.parse(eventModel.data);
                        if (data.DH_node_id.substring(2, 42) === this.config.identity &&
                            data.DH_wallet === this.config.node_wallet) {
                            // I'm chosen for predetermined bid.
                            found = true;
                        }
                    });

                    if (found) {
                        return;
                    }
                }
            }

            // Check if already applied.
            let bidModel = await Models.bids.findOne({ where: { import_id: importId } });
            if (bidModel) {
                this.log.info(`I already sent my bid for offer: ${importId}.`);
                return;
            }

            const profile = await this.blockchain.getProfile(this.config.node_wallet);

            maxTokenAmount = new BN(maxTokenAmount);
            minStakeAmount = new BN(minStakeAmount);
            dataSizeBytes = new BN(dataSizeBytes);
            const totalEscrowTimePerMinute = Math.round(totalEscrowTime / 60000);
            const myPrice = new BN(profile.token_amount_per_byte_minute)
                .mul(dataSizeBytes)
                .mul(new BN(totalEscrowTimePerMinute));
            const myStake = new BN(profile.stake_amount_per_byte_minute)
                .mul(dataSizeBytes)
                .mul(new BN(totalEscrowTimePerMinute));

            if (maxTokenAmount.lt(myPrice)) {
                this.log.info(`Offer ${importId} too cheap for me.`);
                return;
            }

            if (minStakeAmount.gt(myStake)) {
                this.log.info(`Skipping offer ${importId}. Stake too high.`);
                return;
            }

            if (!predeterminedBid && !Utilities.getImportDistance(myPrice, 1, myStake)) {
                this.log.info(`Offer ${importId}, not in mine distance. Not going to participate.`);
                return;
            }

            this.log.trace(`Adding a bid for offer ${importId}.`);

            // From smart contract:
            // uint scope = this_offer.data_size * this_offer.total_escrow_time;
            // require((this_offer.min_stake_amount  <= this_DH.stake_amount * scope) &&
            //          (this_DH.stake_amount * scope <= profile[msg.sender].balance));
            const profileBalance = new BN(profile.balance, 10);
            const condition = myStake;

            if (profileBalance.lt(condition)) {
                await this.blockchain.increaseBiddingApproval(condition.sub(profileBalance));
                await this.blockchain.depositToken(condition.sub(profileBalance));
            }

            await this.blockchain.addBid(importId, this.config.identity);
            // await blockchainc.increaseBiddingApproval(myStake);
            const addedBidEvent = await this.blockchain.subscribeToEvent('AddedBid', importId);
            const dcWallet = await this.blockchain.getDcWalletFromOffer(importId);
            this._saveBidToStorage(
                addedBidEvent,
                dcNodeId,
                dcWallet,
                myPrice,
                totalEscrowTime,
                myStake,
                dataSizeBytes,
                importId,
            );

            await this.blockchain.subscribeToEvent('OfferFinalized', importId);
            // Now check if bid taken.
            // emit BidTaken(bytes32 import_id, address DH_wallet);
            const eventModelBid = await Models.events.findOne({
                where:
                    {
                        event: 'BidTaken',
                        import_id: importId,
                    },
            });
            if (!eventModelBid) {
                // Probably contract failed since no event fired.
                this.log.info(`BidTaken not received for offer ${importId}.`);
                return;
            }

            const eventBid = eventModelBid.get({ plain: true });
            const eventBidData = JSON.parse(eventBid.data);

            if (eventBidData.DH_wallet !== this.config.node_wallet) {
                this.log.info(`Bid not taken for offer ${importId}.`);
                return;
            }

            bidModel = await Models.bids.findOne({ where: { import_id: importId } });
            const bid = bidModel.get({ plain: true });
            await this.network.kademlia().replicationRequest(
                {
                    import_id: importId,
                    wallet: this.config.node_wallet,
                },
                bid.dc_id, (err) => {
                    if (err) {
                        this.log.warn(`Failed to send replication request ${err}`);
                        // TODO Cancel bid here.
                    }
                },
            );
        } catch (error) {
            this.log.error(`Failed to handle offer. ${error}`);
        }
    }

    _saveBidToStorage(
        event,
        dcNodeId,
        dcWallet,
        chosenPrice,
        totalEscrowTime,
        stake,
        dataSizeBytes,
        importId,
    ) {
        Models.bids.create({
            bid_index: event.bid_index,
            price: chosenPrice.toString(),
            import_id: importId,
            dc_wallet: dcWallet,
            dc_id: dcNodeId,
            total_escrow_time: totalEscrowTime.toString(),
            stake: stake.toString(),
            data_size_bytes: dataSizeBytes.toString(),
        }).then((bid) => {
            this.log.info(`Created new bid for offer ${importId}. Waiting for reveal... `);
        }).catch((err) => {
            this.log.error(`Failed to insert new bid. ${err}`);
        });
    }

    /**
     * Handles import received from DC
     * @param data
     * @return {Promise<void>}
     */
    async handleImport(data) {
        const bidModel = await Models.bids.findOne({ where: { import_id: data.import_id } });
        if (!bidModel) {
            this.log.warn(`Couldn't find bid for import ID ${data.import_id}.`);
            return;
        }
        const bid = bidModel.get({ plain: true });
        let importResult;
        try {
            importResult = await this.importer.importJSON({
                import_id: data.import_id,
                vertices: data.vertices,
                edges: data.edges,
                wallet: data.dc_wallet,
            });

            if (importResult.error) {
                throw Error(importResult.error);
            }

            importResult = importResult.response;

            await Models.data_info.create({
                import_id: importResult.import_id,
                total_documents: importResult.vertices.length,
                root_hash: importResult.root_hash,
                data_provider_wallet: importResult.wallet,
                import_timestamp: new Date(),
            });
        } catch (err) {
            this.log.warn(`Failed to import JSON. ${err}.`);
            return;
        }

        this.log.trace('[DH] Replication finished');

        try {
            const encryptedVertices = importResult.vertices.filter(vertex => vertex.vertex_type !== 'CLASS');
            ImportUtilities.sort(encryptedVertices);
            const litigationBlocks = Challenge.getBlocks(encryptedVertices, 32);
            const litigationBlocksMerkleTree = new MerkleTree(litigationBlocks);
            const litigationRootHash = litigationBlocksMerkleTree.getRoot();

            const keyPair = Encryption.generateKeyPair(512);
            const decryptedVertices = encryptedVertices.map((encVertex) => {
                if (encVertex.data) {
                    const key = data.public_key;
                    encVertex.data = Encryption.decryptObject(encVertex.data, key);
                }
                return encVertex;
            });
            Graph.encryptVertices(decryptedVertices, keyPair.privateKey);

            const distributionMerkle = await ImportUtilities.merkleStructure(
                decryptedVertices,
                importResult.edges,
            );
            const distributionHash = distributionMerkle.tree.getRoot();

            const epk = Encryption.packEPK(keyPair.publicKey);
            const epkChecksum = Encryption.calculateDataChecksum(epk, 0, 0, 0);

            this.log.important('Send root hashes and checksum to blockchain.');
            await this.blockchain.addRootHashAndChecksum(
                importResult.import_id,
                litigationRootHash,
                distributionHash,
                Utilities.normalizeHex(epkChecksum),
            );

            // Store holding information and generate keys for eventual
            // data replication.
            const holdingData = await Models.holding_data.create({
                id: importResult.import_id,
                source_wallet: bid.dc_wallet,
                data_public_key: data.public_key,
                distribution_public_key: keyPair.privateKey,
                distribution_private_key: keyPair.privateKey,
                epk,
            });

            if (!holdingData) {
                this.log.warn('Failed to store holding data info.');
            }

            this.log.important('Replication finished. Send data to DC for verification.');
            await this.network.kademlia().verifyImport({
                epk,
                importId: importResult.import_id,
                encryptionKey: keyPair.privateKey,
            }, bid.dc_id);
        } catch (error) {
            this.log.error(`Failed to import data. ${error}.`);
        }
    }

    async handleDataLocationRequest(message) {
        /*
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

        // Check if mine publish.
        if (message.nodeId === this.config.identity &&
            message.wallet === this.config.node_wallet) {
            this.log.trace('Received mine publish. Ignoring.');
            return;
        }

        // Handle query here.
        const { query } = message;
        const imports = await this.graphStorage.findImportIds(query);
        if (imports.length === 0) {
            // I don't want to participate
            this.log.trace(`No imports found for request ${message.id}`);
            return;
        }

        // Check if the import came from network. In more details I can only
        // distribute data gotten from someone else.
        const replicatedImportIds = [];
        // Then check if I bought replication from another DH.
        const data_holders = await Models.holding_data.findAll({
            where: {
                id: {
                    [Op.in]: imports,
                },
            },
        });

        if (data_holders) {
            data_holders.forEach((data_holder) => {
                replicatedImportIds.push(data_holder.id);
            });
        }

        if (imports.length !== replicatedImportIds.length) {
            this.log.info(`Some of the imports aren't redistributable for query ${message.id}`);
            return;
        }

        /*
            dataLocationResponseObject = {
                message: {
                    id: ID,
                    wallet: DH_WALLET,
                    nodeId: KAD_ID,
                    imports: [
                                importId1,
                                importId2
                            ],
                    dataSize: DATA_BYTE_SIZE,
                    dataPrice: TOKEN_AMOUNT,
                    stakeFactor: X
                }
                messageSignature: {
                    c: …,
                    r: …,
                    s: …
                }
            }
         */
        const wallet = this.config.node_wallet;
        const nodeId = this.config.identity;
        const dataSize = 500; // TODO
        const dataPrice = 100000; // TODO
        const stakeFactor = 1000; // TODO

        const networkReplyModel = await Models.network_replies.create({
            data: {
                id: message.id,
                imports,
                dataSize,
                dataPrice,
                stakeFactor,
            },
            receiver_wallet: message.wallet,
            receiver_identity: message.nodeId,
        });

        if (!networkReplyModel) {
            this.log.error('Failed to create new network reply model.');
            throw Error('Internal error.');
        }

        const messageResponse = {
            id: message.id,
            replyId: networkReplyModel.id,
            wallet,
            nodeId,
            imports,
            dataSize,
            dataPrice,
            stakeFactor,
        };

        const messageResponseSignature =
            Utilities.generateRsvSignature(
                JSON.stringify(messageResponse),
                this.web3,
                this.config.node_private_key,
            );

        const dataLocationResponseObject = {
            message: messageResponse,
            messageSignature: messageResponseSignature,
        };

        await this.network.kademlia().sendDataLocationResponse(
            dataLocationResponseObject,
            message.nodeId,
        );
    }

    /**
     * Handles date read request from Kademlia
     * @return {Promise<void>}
     */
    async handleDataReadRequest(message) {
        /*
            message: {
                id: REPLY_ID
                wallet: DH_WALLET,
                nodeId: KAD_ID
            }
        */

        // TODO in order to avoid getting a different import.
        const { nodeId, wallet, id } = message;
        try {
            // Check is it mine offer.
            const networkReplyModel = await Models.network_replies.find({ where: { id } });
            if (!networkReplyModel) {
                throw Error(`Couldn't find reply with ID ${id}.`);
            }

            const offer = networkReplyModel.data;

            if (networkReplyModel.receiver_wallet !== wallet &&
                networkReplyModel.receiver_identity) {
                throw Error('Sorry not your read request');
            }

            // TODO: Only one import ID used. Later we'll support replication from multiple imports.
            // eslint-disable-next-line
            const importId = offer.imports[0];

            const verticesPromise = this.graphStorage.findVerticesByImportId(importId);
            const edgesPromise = this.graphStorage.findEdgesByImportId(importId);

            const values = await Promise.all([verticesPromise, edgesPromise]);
            const vertices = values[0];
            const edges = values[1];

            // Get replication key and then encrypt data.
            const holdingDataModel = await Models.holding_data.find({ where: { id: importId } });

            if (!holdingDataModel) {
                throw Error(`Didn't find import with ID. ${importId}`);
            }

            ImportUtilities.deleteInternal(vertices);
            const holdingData = holdingDataModel.get({ plain: true });
            const dataPublicKey = holdingData.data_public_key;
            const replicationPrivateKey = holdingData.distribution_private_key;

            Graph.decryptVertices(
                vertices.filter(vertex => vertex.vertex_type !== 'CLASS'),
                dataPublicKey,
            );

            Graph.encryptVertices(
                vertices.filter(vertex => vertex.vertex_type !== 'CLASS'),
                replicationPrivateKey,
            );

            // Make sure we have enough token balance before DV makes a purchase.
            // From smart contract:
            // require(DH_balance > stake_amount && DV_balance > token_amount.add(stake_amount));
            const condition = new BN(offer.dataPrice).mul(new BN(offer.stakeFactor));
            const profileBalance =
                new BN((await this.blockchain.getProfile(this.config.node_wallet)).balance, 10);

            if (profileBalance.lt(condition)) {
                await this.blockchain.increaseBiddingApproval(condition.sub(profileBalance));
                await this.blockchain.depositToken(condition.sub(profileBalance));
            }

            /*
            dataReadResponseObject = {
                message: {
                    id: REPLY_ID
                    wallet: DH_WALLET,
                    nodeId: KAD_ID
                    agreementStatus: CONFIRMED/REJECTED,
                    data_provider_wallet,
                    encryptedData: { … }
                },
                messageSignature: {
                    c: …,
                    r: …,
                    s: …
               }
            }
             */

            const dataInfo = await Models.data_info.findOne({
                where: {
                    import_id: importId,
                },
            });

            if (!dataInfo) {
                throw Error(`Failed to get data info for import ID ${importId}.`);
            }

            const replyMessage = {
                id,
                wallet: this.config.node_wallet,
                nodeId: this.config.identity,
                data_provider_wallet: dataInfo.data_provider_wallet,
                agreementStatus: 'CONFIRMED',
                encryptedData: {
                    vertices,
                    edges,
                },
                importId, // TODO: Temporal. Remove it.
            };
            const dataReadResponseObject = {
                message: replyMessage,
                messageSignature: Utilities.generateRsvSignature(
                    JSON.stringify(replyMessage),
                    this.web3,
                    this.config.node_private_key,
                ),
            };

            await this.network.kademlia().sendDataReadResponse(dataReadResponseObject, nodeId);
            await this.listenPurchaseInititation(
                importId, wallet, offer, networkReplyModel,
                holdingData, nodeId, id,
            );
        } catch (e) {
            const errorMessage = `Failed to process data read request. ${e}.`;
            this.log.warn(errorMessage);
            await this.network.kademlia().sendDataReadResponse({
                status: 'FAIL',
                message: errorMessage,
            }, nodeId);
        }
    }

    /**
     * Wait for purchase
     * @return {Promise<void>}
     */
    async listenPurchaseInititation(
        importId, wallet, offer,
        networkReplyModel, holdingData, nodeId, messageId,
    ) {
        // Wait for event from blockchain.
        await this.blockchain.subscribeToEvent('PurchaseInitiated', importId, 20 * 60 * 1000);

        // purchase[DH_wallet][msg.sender][import_id]
        const purchase = await this.blockchain.getPurchase(
            this.config.node_wallet,
            networkReplyModel.receiver_wallet,
            importId,
        );

        if (!purchase) {
            const errorMessage = `Failed to get purchase for: DH ${this.config.node_wallet}, DV ${networkReplyModel.receiver_wallet} and import ID ${importId}.`;
            this.log.error(errorMessage);
            throw errorMessage;
        }

        // Check the conditions.
        const purchaseTokenAmount = new BN(purchase.token_amount);
        const purchaseStakeFactor = new BN(purchase.stake_factor);
        const myPrice = new BN(offer.dataPrice);
        const myStakeFactor = new BN(offer.stakeFactor);

        if (!purchaseTokenAmount.eq(myPrice) || !purchaseStakeFactor.eq(myStakeFactor)) {
            const errorMessage = `Whoa, we didn't agree on this. Purchase price and stake factor: ${purchaseTokenAmount} and ${purchaseStakeFactor}, my price and stake factor: ${myPrice} and ${myStakeFactor}.`;
            this.log.error(errorMessage);
            throw errorMessage;
        }

        this.log.info(`Purchase for import ${importId} seems just fine. Sending comm to contract.`);

        // bool commitment_proof = this_purchase.commitment ==
        // keccak256(checksum_left, checksum_right, checksum_hash,
        //          random_number_1, random_number_2, decryption_key, block_index);

        // Fetch epk from db.
        if (!holdingData) {
            this.log.error(`Cannot find holding data info for import ID ${importId}`);
            throw Error('Internal error');
        }
        const { epk } = holdingData;

        const {
            m1,
            m2,
            selectedBlockNumber,
            selectedBlock,
        } = Encryption.randomDataSplit(epk);

        const r1 = Utilities.getRandomInt(100000);
        const r2 = Utilities.getRandomInt(100000);

        const m1Checksum = Utilities.normalizeHex(Encryption.calculateDataChecksum(m1, r1, r2));
        const m2Checksum = Utilities.normalizeHex(Encryption.calculateDataChecksum(
            m2,
            r1, r2, selectedBlockNumber + 1,
        ));
        const epkChecksum = Utilities.normalizeHex(Encryption.calculateDataChecksum(epk, r1, r2));
        const epkChecksumHash =
            Utilities.normalizeHex(ethAbi.soliditySHA3(
                ['uint256'],
                [epkChecksum],
            ).toString('hex'));
        const e = crypto.randomBytes(32); // 256bits.
        const eHex = Utilities.normalizeHex(e.toString('hex'));
        // For litigation we'll need: Encryption.xor(selectedBlock, e);

        // From smart contract:
        // keccak256(checksum_left, checksum_right, checksum_hash,
        //           random_number_1, random_number_2, decryption_key, block_index);
        const commitmentHash = Utilities.normalizeHex(ethAbi.soliditySHA3(
            ['uint256', 'uint256', 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256'],
            [m1Checksum, m2Checksum, epkChecksumHash, r1, r2, eHex, selectedBlockNumber],
        ).toString('hex'));

        // store block number and block in db because of litigation.

        await this.blockchain.sendCommitment(
            importId,
            networkReplyModel.receiver_wallet,
            commitmentHash,
        );

        await Models.data_holders.create({
            import_id: importId,
            dh_wallet: this.config.node_wallet,
            dh_kademlia_id: this.config.identity,
            m1,
            m2,
            e: eHex,
            sd: epkChecksum,
            r1,
            r2,
            block_number: selectedBlockNumber,
            block: selectedBlock,
        });

        // Send data to DV.
        const encryptedPaddedKeyObject = {
            message: {
                id: messageId,
                wallet: this.config.node_wallet,
                nodeId: this.config.identifiers,
                m1,
                m2,
                e: eHex,
                r1,
                r2,
                sd: epkChecksum,
                blockNumber: selectedBlockNumber,
            },
        };
        encryptedPaddedKeyObject.messageSignature = Utilities.generateRsvSignature(
            JSON.stringify(encryptedPaddedKeyObject.message),
            this.web3,
            this.config.node_private_key,
        );

        await this.network.kademlia().sendEncryptedKey(encryptedPaddedKeyObject, nodeId);

        this.listenPurchaseDispute(
            importId, wallet, m2Checksum,
            epkChecksumHash, selectedBlockNumber,
            m1Checksum, r1, r2, e,
        ).then(() => this.log.info('Purchase dispute completed'));

        this.listenPurchaseConfirmation(
            importId, wallet, networkReplyModel,
            selectedBlock, eHex,
        ).then(() => this.log.important('Purchase confirmation completed'));
    }

    /**
     * Wait and process purchase confirmation
     * @return {Promise<void>}
     */
    async listenPurchaseConfirmation(importId, wallet, networkReplyModel, selectedBlock, eHex) {
        const eventData = await this.blockchain.subscribeToEvent('PurchaseConfirmed', importId, 10 * 60 * 1000);
        if (!eventData) {
            // Everything is ok.
            this.log.warn(`Purchase not confirmed for ${importId}.`);
            await this.blockchain.cancelPurchase(importId, wallet, true);
            this.log.important(`Purchase for import ${importId} canceled.`);
            return;
        }

        this.log.important(`[DH] Purchase confirmed for import ID ${importId}`);
        await this.blockchain.sendEncryptedBlock(
            importId,
            networkReplyModel.receiver_wallet,
            Utilities.normalizeHex(Encryption.xor(
                Buffer.from(selectedBlock, 'ascii').toString('hex'),
                Utilities.denormalizeHex(eHex),
            )),
        );
        this.log.notify(`[DH] Encrypted block sent for import ID ${importId}`);
        this.blockchain.subscribeToEvent('PurchaseConfirmed', importId, 10 * 60 * 1000);

        // Call payOut() after 5 minutes. Requirement from contract.
        setTimeout(() => {
            this.blockchain.payOutForReading(importId, networkReplyModel.receiver_wallet)
                .then(() => this.log.info(`[DH] Payout finished for import ID ${importId} and DV ${networkReplyModel.receiver_wallet}.`))
                .catch(error => this.log.info(`[DH] Payout failed for import ID ${importId} and DV ${networkReplyModel.receiver_wallet}. ${error}.`));
        }, 5 * 60 * 1000);
    }

    /**
     * Monitor for litigation event. Just in case.
     * @return {Promise<void>}
     */
    async listenPurchaseDispute(
        importId, wallet, m2Checksum, epkChecksumHash,
        selectedBlockNumber, m1Checksum, r1, r2, e,
    ) {
        let eventData = await this.blockchain.subscribeToEvent('PurchaseDisputed', importId, 10 * 60 * 1000);
        if (!eventData) {
            // Everything is ok.
            this.log.info(`No litigation process initiated for purchase for ${importId}.`);
            return;
        }

        await this.blockchain.sendProofData(
            importId, wallet, m1Checksum,
            m2Checksum, epkChecksumHash, r1, r2,
            Utilities.normalizeHex(e.toString('hex')), selectedBlockNumber,
        );

        // emit PurchaseDisputeCompleted(import_id, msg.sender, DV_wallet, false);
        eventData = this.blockchain.subscribeToEvent('PurchaseDisputeCompleted', importId, 10 * 60 * 1000);
        if (eventData.proof_was_correct) {
            this.log.info(`Litigation process for purchase ${importId} was fortunate for me.`);
        } else {
            this.log.info(`Litigation process for purchase ${importId} was unfortunate for me.`);
        }
    }

    /**
     * Checking if node Hash is close enugh to respond to bid
     * @param k - Number of required data holders
     * @param numNodes - Number of registered nodes on ODN network
     * @param dataHash - Import hash
     * @param nodeHash - DH node hash
     * @param correctionFactor
     */
    amIClose(k, numNodes, dataHash, nodeHash, correctionFactor = 100) {
        const two = new BN(2);
        const deg128 = two.pow(new BN(128));
        const intervalBn = deg128.div(new BN(numNodes, 10));

        const marginBn = intervalBn.mul(new BN(k, 10)).div(two);

        const dataHashBn = new BN(Utilities.denormalizeHex(dataHash), 16);

        let intervalTo;
        let higherMargin = marginBn;

        if (dataHashBn.lt(marginBn)) {
            intervalTo = (two).mul(marginBn);
            higherMargin = intervalTo.sub(dataHashBn);
        }


        if ((dataHashBn.add(marginBn)).gte(deg128)) {
            higherMargin = dataHashBn.add(marginBn).sub(deg128).add(marginBn);
        }

        const nodeHashBn = new BN(Utilities.denormalizeHex(nodeHash), 16);

        let distance;
        if (dataHashBn.gt(nodeHashBn)) {
            distance = dataHashBn.sub(nodeHashBn);
        } else {
            distance = nodeHashBn.sub(dataHashBn);
        }

        if (distance.lt(higherMargin.mul(new BN(correctionFactor)).div(new BN(100)))) {
            return true;
        }
        return false;
    }

    /**
     * Handles litigation initiation from DC side
     * @param importId
     * @param dhWallet
     * @param blockId
     * @return {Promise<void>}
     */
    async litigationInitiated(importId, dhWallet, blockId) {
        if (dhWallet !== this.config.node_wallet) {
            return;
        }
        this.log.debug(`Litigation initiated for import ${importId} and block ${blockId}`);

        let vertices = await this.graphStorage.findVerticesByImportId(importId);
        ImportUtilities.sort(vertices);
        // filter CLASS vertices
        vertices = vertices.filter(vertex => vertex.vertex_type !== 'CLASS'); // Dump class objects.
        const answer = Challenge.answerTestQuestion(blockId, vertices, 32);

        this.log.debug(`Answer litigation for import ${importId}. Answer for block ${blockId} is ${answer}`);
        await this.blockchain.answerLitigation(importId, answer);
    }

    async dataLocationQuery(queryId) {
        const networkQuery = await Models.network_queries.find({ where: { id: queryId } });
        if (networkQuery.status !== 'FINISHED') {
            throw Error('Query not finished.');
        }

        // Fetch the results.
        const importIds =
            await this.graphStorage.findImportIds(networkQuery.query);
        const decryptKeys = {};

        // Get decode keys.
        const holdingData = await Models.holding_data.findAll({
            where: {
                id: {
                    [Op.in]: importIds,
                },
            },
        });

        if (holdingData) {
            holdingData.forEach((data) => {
                decryptKeys[data.id] = data.data_public_key;
            });
        }

        const encodedVertices =
            await this.graphStorage.dataLocationQuery(networkQuery.query);
        const vertices = [];

        encodedVertices.forEach((encodedVertex) => {
            const foundIds =
                encodedVertex.imports.filter(value => importIds.indexOf(value) !== -1);

            switch (foundIds.length) {
            case 1:
                // Decrypt vertex.
                {
                    const decryptedVertex = Utilities.copyObject(encodedVertex);
                    decryptedVertex.data =
                        Encryption.decryptObject(
                            encodedVertex.data,
                            decryptKeys[foundIds[0]],
                        );
                    vertices.push(decryptedVertex);
                }
                break;
            case 0:
                // Vertex is not encrypted.
                vertices.push(Utilities.copyObject(encodedVertex));
                break;
            default:
                // Multiple keys founded. Temp solution.
                for (let i = 0; i < foundIds.length; i += 1) {
                    try {
                        const decryptedVertex = Utilities.copyObject(encodedVertex);
                        decryptedVertex.data =
                                Encryption.decryptObject(
                                    encodedVertex.data,
                                    decryptKeys[foundIds[i]],
                                );
                        vertices.push(decryptedVertex);
                        break; // Found the right key.
                    } catch (error) {
                        // Ignore.
                    }
                }
                break;
            }
        });

        return vertices;
    }

    /**
     * Returns given import's vertices and edges and decrypt them if needed.
     *
     * Method will return object in following format { vertices: [], edges: [] }.
     * @param importId ID of import.
     * @returns {Promise<*>}
     */
    async getVerticesForImport(importId) {
        // Check if import came from DH replication or reading replication.
        const holdingData = await Models.holding_data.find({ where: { id: importId } });

        if (holdingData) {
            const verticesPromise = this.graphStorage.findVerticesByImportId(importId);
            const edgesPromise = this.graphStorage.findEdgesByImportId(importId);

            const values = await Promise.all([verticesPromise, edgesPromise]);

            const encodedVertices = values[0];
            const edges = values[1];
            const decryptKey = holdingData.data_public_key;
            const vertices = [];

            encodedVertices.forEach((encodedVertex) => {
                const decryptedVertex = Utilities.copyObject(encodedVertex);
                if (decryptedVertex.vertex_type !== 'CLASS') {
                    decryptedVertex.data =
                        Encryption.decryptObject(
                            encodedVertex.data,
                            decryptKey,
                        );
                }
                vertices.push(decryptedVertex);
            });

            return { vertices, edges };
        }

        // Check if import came from DC side.
        const dataInfo = await Models.data_info.find({ where: { import_id: importId } });

        if (dataInfo) {
            const verticesPromise = this.graphStorage.findVerticesByImportId(importId);
            const edgesPromise = this.graphStorage.findEdgesByImportId(importId);

            const values = await Promise.all([verticesPromise, edgesPromise]);

            return { vertices: values[0], edges: values[1] };
        }

        throw Error(`Cannot find vertices for import ID ${importId}.`);
    }

    listenToBlockchainEvents() {
        this.blockchain.subscribeToEventPermanent([
            'AddedPredeterminedBid',
            'OfferCreated',
            'LitigationInitiated',
            'LitigationCompleted',
            'EscrowVerified',
        ]);
    }
}

module.exports = DHService;
