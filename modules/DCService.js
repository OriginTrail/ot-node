const Encryption = require('./Encryption');
const Graph = require('./Graph');
const bytes = require('utf8-length');
const BN = require('bn.js');
const Utilities = require('./Utilities');
const Models = require('../models');
const Challenge = require('./Challenge');
const MerkleTree = require('./Merkle');
const ImportUtilities = require('./ImportUtilities');

const { Op } = Models.Sequelize;
const finalizeWaitTime = 10 * 60 * 1000;
/**
 * DC operations (handling new offers, etc.)
 */
class DCService {
    /**
     * Default constructor
     * @param ctx IoC context
     */
    constructor(ctx) {
        this.blockchain = ctx.blockchain;
        this.challenger = ctx.challenger;
        this.graphStorage = ctx.graphStorage;
        this.log = ctx.logger;
        this.config = ctx.config;
        this.network = ctx.network;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Creates new offer
     * @param importId
     * @param rootHash
     * @param totalDocuments
     * @param vertices
     * @param total_escrow_time
     * @param max_token_amount
     * @param min_stake_amount
     * @param min_reputation
     * @return {Promise<external_id|{type, defaultValue}|offers.external_id|{type, allowNull}>}
     */
    async createOffer(
        importId,
        rootHash,
        totalDocuments,
        vertices,
        total_escrow_time,
        max_token_amount,
        min_stake_amount,
        min_reputation,
    ) {
        // Check if offer already exists
        const oldOffer = await this.blockchain.getOffer(importId);
        if (oldOffer[0] !== '0x0000000000000000000000000000000000000000') {
            if (oldOffer.finalized) {
                throw new Error(`Offer for ${importId} already exists. Offer is finalized therefore cannot be cancelled.`);
            }
            this.log.info(`Offer for ${importId} already exists. Cancelling offer...`);
            await this.blockchain.cancelOffer(importId).catch((error) => {
                throw new Error(`Cancelling offer failed. ${error}.`);
            });
            // cancel challenges for cancelled offer
            await Models.replicated_data.update(
                { status: 'CANCELLED' },
                { where: { import_id: importId } },
            );
            // update offer to CANCELLED
            await Models.offers.update(
                { status: 'CANCELLED' },
                { where: { import_id: importId, status: { [Op.not]: 'FINALIZED' } } },
            );
        }

        const dhIds = [];
        const dhWallets = [];

        let totalEscrowTime = new BN(this.config.total_escrow_time_in_milliseconds);
        let maxTokenAmount = new BN(this.config.max_token_amount_per_dh, 10);
        let minStakeAmount = new BN(this.config.dh_min_stake_amount, 10);
        let minReputation = this.config.dh_min_reputation;

        if (total_escrow_time) {
            totalEscrowTime = new BN(total_escrow_time);
        }

        if (max_token_amount) {
            maxTokenAmount = new BN(max_token_amount, 10);
        }

        if (min_stake_amount) {
            minStakeAmount = new BN(min_stake_amount, 10);
        }

        if (min_reputation) {
            minReputation = min_reputation;
        }

        vertices.forEach((vertex) => {
            if (vertex.data && vertex.data.wallet && vertex.data.node_id) {
                dhWallets.push(vertex.data.wallet);
                dhIds.push(vertex.data.node_id);
            }
        });

        totalEscrowTime = totalEscrowTime.div(new BN(60000));
        const importSizeInBytes = new BN(this._calculateImportSize(vertices));
        const newOfferRow = {
            import_id: importId,
            total_escrow_time: totalEscrowTime.toString(),
            max_token_amount: maxTokenAmount.toString(),
            min_stake_amount: minStakeAmount.toString(),
            min_reputation: minReputation,
            data_hash: rootHash,
            data_size_bytes: importSizeInBytes.toString(),
            dh_wallets: dhWallets,
            dh_ids: dhIds,
            message: 'Offer is pending',
            start_tender_time: Date.now(), // TODO: Problem. Actual start time is returned by SC.
            status: 'PENDING',
        };
        const offer = await Models.offers.create(newOfferRow);

        // Check if root-hash already written.
        this.blockchain.getRootHash(this.config.node_wallet, importId)
            .then(async (blockchainRootHash) => {
                if (blockchainRootHash.toString() === '0x0000000000000000000000000000000000000000000000000000000000000000') {
                    this.remoteControl.writingRootHash(importId);
                    await this.blockchain.writeRootHash(importId, rootHash).catch((err) => {
                        offer.status = 'FAILED';
                        offer.save({ fields: ['status'] });
                        throw Error(`Failed to write fingerprint on blockchain. ${err}`);
                    });
                } else if (blockchainRootHash !== rootHash) {
                    throw Error(`Calculated roothash (${rootHash}) differs from one on blockchain (${blockchainRootHash}).`);
                }

                this.log.info('Fingerprint written on blockchain');
                this.remoteControl.initializingOffer(importId);

                const profileBalance =
                    new BN((await this.blockchain.getProfile(this.config.node_wallet)).balance, 10);

                const replicationModifier = await this.blockchain.getReplicationModifier();

                const condition = maxTokenAmount
                    .mul((new BN((dhWallets.length * 2)).add(new BN(replicationModifier, 10))))
                    .mul(importSizeInBytes)
                    .mul(totalEscrowTime);

                if (profileBalance.lt(condition)) {
                    await this.blockchain.increaseBiddingApproval(condition.sub(profileBalance));
                    await this.blockchain.depositToken(condition.sub(profileBalance));
                }

                this.blockchain.createOffer(
                    importId,
                    this.config.identity,
                    totalEscrowTime,
                    maxTokenAmount,
                    minStakeAmount,
                    minReputation,
                    rootHash,
                    importSizeInBytes,
                    dhWallets,
                    dhIds,
                ).then(async () => {
                    this.log.important(`Offer ${importId} written to blockchain. Started bidding phase.`);
                    this.remoteControl.biddingStarted(importId);
                    offer.status = 'STARTED';
                    await offer.save({ fields: ['status'] });

                    await this.blockchain.subscribeToEvent('FinalizeOfferReady', null, finalizeWaitTime, null, event => event.import_id === importId).then((event) => {
                        if (!event) {
                            this.log.notify(`Offer ${importId} not finalized. Canceling offer.`);
                            this.remoteControl.cancelingOffer(`Offer ${importId} not finalized. Canceling offer.`, importId);
                            this.blockchain.cancelOffer(importId).then(() => {
                                offer.status = 'CANCELLED';
                                offer.message = 'Offer not finalized';
                                offer.save({ fields: ['status', 'message'] });
                                this.log.trace(`Offer ${importId} canceled.`);
                            }).catch((error) => {
                                this.log.warn(`Failed to cancel offer for import ${importId}. ${error}.`);
                                offer.status = 'STARTED';
                                offer.message = 'Failed to cancel. Still opened';
                                offer.save({ fields: ['status', 'message'] });
                            });
                            return;
                        }

                        setTimeout(() => {
                            this.log.trace('Started choosing phase.');
                            this.remoteControl.biddingComplete(importId);
                            this.remoteControl.choosingBids(importId);

                            offer.status = 'FINALIZING';
                            offer.save({ fields: ['status'] });

                            this.chooseBids(offer.id, totalEscrowTime).then(() => {
                                this.blockchain.subscribeToEvent('OfferFinalized', offer.import_id)
                                    .then(() => {
                                        const errorMsg = `Offer for import ${offer.import_id} finalized`;
                                        offer.status = 'FINALIZED';
                                        this.remoteControl.bidChosen(importId);
                                        this.remoteControl.offerFinalized(`Offer for import ${offer.import_id} finalized`, importId);
                                        offer.message = errorMsg;
                                        offer.save({ fields: ['status', 'message'] });
                                        this.log.info(errorMsg);
                                    }).catch((error) => {
                                        const errorMsg = `Failed to get offer for import ${offer.import_id}). ${error}.`;
                                        offer.status = 'FAILED';
                                        offer.message = errorMsg;
                                        offer.save({ fields: ['status', 'message'] });
                                        this.log.error(errorMsg);
                                        this.remoteControl.dcErrorHandling(errorMsg);
                                    });
                            }).catch((err) => {
                                const errorMsg = `Failed to choose bids. ${err}`;
                                offer.status = 'FAILED';
                                offer.message = errorMsg;
                                offer.save({ fields: ['status', 'message'] });
                                this.log.error(errorMsg);
                                this.remoteControl.dcErrorHandling(errorMsg);
                            });
                        }, 30000);
                    });
                }).catch((err) => {
                    const errorMsg = `Failed to create offer. ${err}.`;
                    offer.status = 'FAILED';
                    offer.message = errorMsg;
                    offer.save({ fields: ['status', 'message'] });
                    this.log.error(errorMsg);
                    this.remoteControl.dcErrorHandling(errorMsg);
                });
            }).catch((err) => {
                const errorMsg = `Failed to fetch root hash for import ${importId}. ${err}.`;
                offer.status = 'FAILED';
                offer.message = errorMsg;
                offer.save({ fields: ['status', 'message'] });
                this.log.error(errorMsg);
                this.remoteControl.dcErrorHandling(errorMsg);
            });
        return offer.external_id;
    }

    /**
     * Gets offer by external_id
     * @param externalId
     * @return {Promise<external_id|{type, defaultValue}|offers.external_id|{type, allowNull}>}
     */
    async getOffer(externalId) {
        return Models.offers.findOne({ where: { external_id: externalId } });
    }

    /**
     * Calculates more or less accurate size of the import
     * @param vertices   Collection of vertices
     * @returns {number} Size in bytes
     * @private
     */
    _calculateImportSize(vertices) {
        const keyPair = Encryption.generateKeyPair(); // generate random pair of keys
        Graph.encryptVertices(vertices, keyPair.privateKey);
        return bytes(JSON.stringify(vertices));
    }

    /**
     * Chose DHs
     * @param offerId Offer identifier
     * @param totalEscrowTime Total escrow time
     */
    chooseBids(offerId, totalEscrowTime) {
        return new Promise((resolve, reject) => {
            Models.offers.findOne({ where: { id: offerId } }).then((offerModel) => {
                const offer = offerModel.get({ plain: true });
                this.log.info(`Choose bids for offer ID ${offerId}, import ID ${offer.import_id}.`);
                this.blockchain.chooseBids(offer.import_id)
                    .then(() => {
                        this.log.info(`Bids chosen for offer ID ${offerId}, import ID ${offer.import_id}.`);
                        resolve();
                    }).catch((err) => {
                        this.log.warn(`Failed call choose bids for offer ID ${offerId}, import ID ${offer.import_id}. ${err}`);
                        reject(err);
                    });
            }).catch((err) => {
                this.log.error(`Failed to get offer ID ${offerId}. ${err}.`);
                reject(err);
            });
        });
    }

    /**
     * Verifies DH import and distribution key
     * @param epk
     * @param importId
     * @param encryptionKey
     * @param kadWallet
     * @param nodeId
     * @return {Promise<void>}
     */
    async verifyImport(epk, importId, encryptionKey, kadWallet, nodeId) {
        const replicatedData = await Models.replicated_data.findOne({
            where: { dh_id: nodeId, import_id: importId },
        });

        const edgesPromise = this.graphStorage.findEdgesByImportId(importId);
        const verticesPromise = this.graphStorage.findVerticesByImportId(importId);

        await Promise.all([edgesPromise, verticesPromise]).then(async (values) => {
            const edges = values[0];
            const vertices = values[1].filter(vertex => vertex.vertex_type !== 'CLASS');

            const originalVertices = Utilities.copyObject(vertices);
            const clonedVertices = Utilities.copyObject(vertices);
            Graph.encryptVertices(clonedVertices, replicatedData.data_private_key);

            ImportUtilities.sort(clonedVertices);
            const litigationBlocks = Challenge.getBlocks(clonedVertices, 32);
            const litigationBlocksMerkleTree = new MerkleTree(litigationBlocks);
            const litigationRootHash = litigationBlocksMerkleTree.getRoot();

            Graph.encryptVertices(vertices, encryptionKey);
            const distributionMerkle = await ImportUtilities.merkleStructure(
                vertices,
                edges,
            );
            const distributionHash = distributionMerkle.tree.getRoot();
            const epkChecksum = Encryption.calculateDataChecksum(epk, 0, 0, 0);

            const escrow = await this.blockchain.getEscrow(importId, kadWallet);

            let failed = false;
            if (escrow.distribution_root_hash !== Utilities.normalizeHex(distributionHash)) {
                this.log.warn(`Distribution hash for import ${importId} and DH ${kadWallet} is incorrect`);
                failed = true;
            }

            if (escrow.litigation_root_hash !== Utilities.normalizeHex(litigationRootHash)) {
                this.log.warn(`Litigation hash for import ${importId} and DH ${kadWallet} is incorrect`);
                failed = true;
            }

            if (!escrow.checksum === epkChecksum) {
                this.log.warn(`Checksum for import ${importId} and DH ${kadWallet} is incorrect`);
                failed = true;
            }

            const decryptionKey = Encryption.unpadKey(Encryption.globalDecrypt(epk));
            const decryptedVertices = Graph.decryptVertices(vertices, decryptionKey);
            if (!ImportUtilities.compareDocuments(decryptedVertices, originalVertices)) {
                this.log.warn(`Decryption key for import ${importId} and DH ${kadWallet} is incorrect`);
                failed = true;
            }

            if (failed) {
                await this.blockchain.cancelEscrow(
                    kadWallet,
                    importId,
                );
                await this.network.kademlia().sendVerifyImportResponse({
                    status: 'fail',
                    import_id: importId,
                }, nodeId);
                return;
            }
            await this.blockchain.verifyEscrow(
                importId,
                kadWallet,
            );
            this.log.important(`Holding data for offer ${importId} and contact ${kadWallet} successfully verified. Challenges taking place...`);

            replicatedData.status = 'ACTIVE';
            await replicatedData.save({ fields: ['status'] });

            await this.network.kademlia().sendVerifyImportResponse({
                status: 'success',
                import_id: importId,
            }, nodeId);
        });
    }
}

module.exports = DCService;
