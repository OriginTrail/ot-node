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
            const offerModel = await Models.offers.findOne({ where: { id: importId } });
            if (offerModel) {
                const offer = offerModel.get({ plain: true });
                this.log.trace(`Mine offer (ID ${offer.data_hash}). Ignoring.`);
                return;
            }

            const holdingData = await Models.holding_data.findOne({
                where: { root_hash: dataHash },
            });
            if (holdingData) {
                this.log.trace(`I've already stored data for root hash ${dataHash}. Ignoring.`);
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

            const maxDataSizeBytes = new BN(this.config.dh_max_data_size_bytes, 10);

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
                this.log.info(`Offer ${importId} too expensive for me.`);
                return;
            }

            if (minStakeAmount.gt(myStake)) {
                this.log.info(`Skipping offer ${importId}. Stake too high.`);
                return;
            }

            if (maxDataSizeBytes.lt(dataSizeBytes)) {
                this.log.trace(`Skipping offer because of data size. Offer data size in bytes is ${dataSizeBytes}.`);
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
                dcNodeId.substring(2, 42),
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
            this.network.kademlia().replicationRequest(
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
        try {
            await this.importer.importJSON(data);
        } catch (err) {
            this.log.warn(`Failed to import JSON successfully. ${err}.`);
            return;
        }

        data.edges = Graph.sortVertices(data.edges);
        data.vertices = Graph.sortVertices(data.vertices);
        data.vertices = data.vertices.filter(vertex => vertex.vertex_type !== 'CLASS');

        const merkle = await ImportUtilities.merkleStructure(
            data.vertices,
            data.edges,
        );

        const rootHash = merkle.tree.getRoot();
        this.log.trace(`[DH] Root hash calculated. Root hash: ${rootHash}`);

        this.log.trace('[DH] Replication finished');

        try {
            const encryptedVertices = data.vertices;
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
                data.edges,
            );
            const distributionHash = distributionMerkle.tree.getRoot();

            const epk = Encryption.packEPK(keyPair.publicKey);
            const epkChecksum = Encryption.calculateDataChecksum(epk, 0, 0, 0);

            this.log.important('Send root hashes and checksum to blockchain.');
            await this.blockchain.addRootHashAndChecksum(
                data.import_id,
                litigationRootHash,
                distributionHash,
                Utilities.normalizeHex(epkChecksum),
            );

            // Store holding information and generate keys for eventual
            // data replication.
            const holdingData = await Models.holding_data.create({
                id: data.import_id,
                source_wallet: bid.dc_wallet,
                data_public_key: data.public_key,
                distribution_public_key: keyPair.privateKey,
                distribution_private_key: keyPair.privateKey,
                root_hash: data.root_hash,
                epk,
            });

            if (!holdingData) {
                this.log.warn('Failed to store holding data info.');
            }

            this.log.important('Replication finished. Send data to DC for verification.');
            this.network.kademlia().verifyImport({
                epk,
                importId: data.import_id,
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

        this.network.kademlia().sendDataLocationResponse(
            dataLocationResponseObject,
            message.nodeId,
        );
    }

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

        // Check is it mine offer.
        const networkReplyModel = await Models.network_replies.find({ where: { id } });

        if (!networkReplyModel) {
            throw Error(`Couldn't find reply with ID ${id}.`);
        }

        const offer = networkReplyModel.data;

        if (networkReplyModel.receiver_wallet !== wallet && networkReplyModel.receiver_identity) {
            throw Error('Sorry not your read request');
        }

        // TODO: Only one import ID used. Later we'll support replication from multiple imports.
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
        const condition = new BN(offer.dataPrice).mul(new BN(offer.stakeFactor)).add(new BN(1));
        const profileBalance =
            new BN((await this.blockchain.getProfile(this.config.node_wallet)).balance, 10);

        if (profileBalance.lt(condition)) {
            await this.blockchain.increaseBiddingApproval(condition.sub(profileBalance));
            await this.blockchain.depositToken(condition.sub(profileBalance));
        }

        // TODO: Sign escrow here.

        // TODO: dataReadResponseObject might be redundant
        // TODO since same info can be gathered from escrow.
        /*
            dataReadResponseObject = {
                message: {
                    id: REPLY_ID
                    wallet: DH_WALLET,
                    nodeId: KAD_ID
                    agreementStatus: CONFIRMED/REJECTED,
                    purchaseId: PURCHASE_ID,
                    encryptedData: { … }
                },
                messageSignature: {
                    c: …,
                    r: …,
                    s: …
               }
            }
         */

        const replyMessage = {
            id,
            wallet: this.config.node_wallet,
            nodeId: this.config.identity,
            agreementStatus: 'CONFIRMED',
            purchaseId: 'PURCHASE_ID',
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

        this.network.kademlia().sendDataReadResponse(dataReadResponseObject, nodeId);

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
        //          random_number_1, random_number_2, decryption_key, block_index);
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

        Models.data_holders.create({
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
                id,
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

        // Monitor for litigation event. Just in case.
        // TODO: Create permanent event filter for this.
        this.blockchain.subscribeToEvent('PurchaseDisputed', importId, 10 * 60 * 1000).then(async (eventData) => {
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

            // TODO: Here we should wait for litigation result.
        });

        this.network.kademlia().sendEncryptedKey(encryptedPaddedKeyObject, nodeId);

        const eventData = await this.blockchain.subscribeToEvent('PurchaseConfirmed', importId, 10 * 60 * 1000);

        if (!eventData) {
            // Everything is ok.
            this.log.warn(`Purchase not confirmed for ${importId}.`);
            // TODO Initiate canceling purchase.
            return;
        }

        this.log.info(`[DH] Purchase confirmed for import ID ${importId}`);

        await this.blockchain.sendEncryptedBlock(
            importId,
            networkReplyModel.receiver_wallet,
            Utilities.normalizeHex(Encryption.xor(
                selectedBlock,
                Utilities.denormalizeHex(eHex),
            )),
        );
        this.log.info(`[DH] Encrypted block sent for import ID ${importId}`);
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

    listenToBlockchainEvents() {
        this.blockchain.subscribeToEventPermanent(['AddedPredeterminedBid', 'OfferCreated', 'LitigationInitiated', 'LitigationCompleted']);
    }
}

module.exports = DHService;
