const config = require('./Config');
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
const totalEscrowTime = 10 * 60 * 1000;
const finalizeWaitTime = 10 * 60 * 1000;
const minStakeAmount = new BN('100');
const maxTokenAmount = new BN('1000000');
const minReputation = 0;
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
        this.network = ctx.network;
    }

    /**
     * Creates new offer
     * @param importId
     * @param rootHash
     * @param totalDocuments
     * @param vertices
     * @return {Promise<external_id|{type, defaultValue}|offers.external_id|{type, allowNull}>}
     */
    async createOffer(importId, rootHash, totalDocuments, vertices) {
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
        vertices.forEach((vertex) => {
            if (vertex.data && vertex.data.wallet && vertex.data.node_id) {
                dhWallets.push(vertex.data.wallet);
                dhIds.push(vertex.data.node_id);
            }
        });

        const importSizeInBytes = new BN(this._calculateImportSize(vertices));
        const newOfferRow = {
            import_id: importId,
            total_escrow_time: totalEscrowTime,
            max_token_amount: maxTokenAmount.toString(),
            min_stake_amount: minStakeAmount.toString(),
            min_reputation: minReputation,
            data_hash: rootHash,
            data_size_bytes: importSizeInBytes.toString(),
            dh_wallets: JSON.stringify(dhWallets),
            dh_ids: JSON.stringify(dhIds),
            message: 'Offer is pending',
            start_tender_time: Date.now(), // TODO: Problem. Actual start time is returned by SC.
            status: 'PENDING',
        };
        const offer = await Models.offers.create(newOfferRow);

        // Check if root-hash already written.
        const blockchainRootHash = await this.blockchain.getRootHash(config.node_wallet, importId);

        if (blockchainRootHash.toString() === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            await this.blockchain.writeRootHash(importId, rootHash).catch((err) => {
                offer.status = 'FAILED';
                offer.save({ fields: ['status'] });
                throw Error(`Failed to write fingerprint on blockchain. ${err}`);
            });
        } else if (blockchainRootHash !== rootHash) {
            throw Error(`Calculated roothash (${rootHash}) differs from one on blockchain (${blockchainRootHash}).`);
        }

        this.log.info('Fingerprint written on blockchain');

        const profileBalance =
            new BN((await this.blockchain.getProfile(config.node_wallet)).balance, 10);
        const condition = maxTokenAmount.mul(new BN((dhWallets.length * 2) + 1));

        if (profileBalance.lt(condition)) {
            await this.blockchain.increaseBiddingApproval(condition.sub(profileBalance));
            await this.blockchain.depositToken(condition.sub(profileBalance));
        }

        this.blockchain.createOffer(
            importId,
            config.identity,
            totalEscrowTime,
            maxTokenAmount,
            minStakeAmount,
            minReputation,
            rootHash,
            importSizeInBytes,
            dhWallets,
            dhIds,
        ).then(async () => {
            this.log.info('Offer written to blockchain. Started bidding phase.');
            offer.status = 'STARTED';
            offer.save({ fields: ['status'] });

            this.blockchain.subscribeToEvent('FinalizeOfferReady', null, finalizeWaitTime, null, event => event.import_id === importId).then((event) => {
                if (!event) {
                    this.log.notify(`Offer ${importId} not finalized. Canceling offer.`);
                    this.blockchain.cancelOffer(importId).then(() => {
                        offer.status = 'CANCELLED';
                        offer.message = 'Offer not finalized';
                        offer.save({ fields: ['status', 'message'] });
                        this.log.trace(`Offer ${importId} canceled.`);
                    }).catch((error) => {
                        this.log.warn(`Failed to cancel offer ${importId}. ${error}.`);
                        offer.status = 'STARTED';
                        offer.message = 'Failed to cancel. Still opened';
                        offer.save({ fields: ['status', 'message'] });
                    });
                    return;
                }

                this.log.trace('Started choosing phase.');

                offer.status = 'FINALIZING';
                offer.save({ fields: ['status'] });
                this.chooseBids(offer.id, totalEscrowTime).then(() => {
                    this.blockchain.subscribeToEvent('OfferFinalized', offer.import_id)
                        .then(() => {
                            const errorMsg = `Offer for import ${offer.import_id} finalized`;
                            offer.status = 'FINALIZED';
                            offer.message = errorMsg;
                            offer.save({ fields: ['status', 'message'] });
                            this.log.info(errorMsg);
                        }).catch((error) => {
                            const errorMsg = `Failed to get offer for import ${offer.import_id}). ${error}.`;
                            offer.status = 'FAILED';
                            offer.message = errorMsg;
                            offer.save({ fields: ['status', 'message'] });
                            this.log.error(errorMsg);
                        });
                }).catch((err) => {
                    const errorMsg = `Failed to choose bids. ${err}`;
                    offer.status = 'FAILED';
                    offer.message = errorMsg;
                    offer.save({ fields: ['status', 'message'] });
                    this.log.error(errorMsg);
                });
            });
        }).catch((err) => {
            const errorMsg = `Failed to create offer. ${err}.`;
            offer.status = 'FAILED';
            offer.message = errorMsg;
            offer.save({ fields: ['status', 'message'] });
            this.log.error(errorMsg);
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
     * @param totalEscrowTime   Total escrow time
     */
    chooseBids(offerId, totalEscrowTime) {
        return new Promise((resolve, reject) => {
            Models.offers.findOne({ where: { id: offerId } }).then((offerModel) => {
                const offer = offerModel.get({ plain: true });
                this.log.info(`Choose bids for offer ID ${offerId}, import ID ${offer.import_id}.`);
                this.blockchain.increaseApproval(offer.max_token_amount * offer.replication_number)
                    .then(() => {
                        this.blockchain.chooseBids(offer.import_id)
                            .then(() => {
                                this.log.info(`Bids chosen for offer ID ${offerId}, import ID ${offer.import_id}.`);
                                resolve();
                            }).catch((err) => {
                                this.log.warn(`Failed call choose bids for offer ID ${offerId}, import ID ${offer.import_id}. ${err}`);
                                reject(err);
                            });
                    }).catch((err) => {
                        this.log.warn(`Failed to increase allowance. ${JSON.stringify(err)}`);
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
            this.log.warn('Data successfully verified, preparing to start challenges');
            await this.challenger.startChallenging();

            await this.network.kademlia().sendVerifyImportResponse({
                status: 'success',
                import_id: importId,
            }, nodeId);
        });
    }
}

module.exports = DCService;
