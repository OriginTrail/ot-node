const BN = require('bn.js');
const path = require('path');

const Encryption = require('../Encryption');
const ImportUtilities = require('../ImportUtilities');
const MerkleTree = require('../Merkle');
const Models = require('../../models/index');
const Utilities = require('../Utilities');

/**
 * Supported versions of the same data set
 * @type {{RED: string, BLUE: string, GREEN: string}}
 */
const COLOR = {
    RED: 'red',
    BLUE: 'blue',
    GREEN: 'green',
};

class ReplicationService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.graphStorage = ctx.graphStorage;
        this.challengeService = ctx.challengeService;
        this.replicationCache = {};
    }

    /**
     * Creates replications for one Offer
     * @param internalOfferId   - Internal Offer ID
     * @returns {Promise<void>}
     */
    async createReplications(internalOfferId) {
        const offer = await Models.offers.findOne({ where: { id: internalOfferId } });
        if (!offer) {
            throw new Error(`Failed to find offer with internal ID ${internalOfferId}`);
        }

        const [edges, vertices] = await Promise.all([
            this.graphStorage.findEdgesByImportId(offer.data_set_id),
            this.graphStorage.findVerticesByImportId(offer.data_set_id),
        ]);

        const that = this;
        this.replicationCache[internalOfferId] = {};
        return Promise.all([COLOR.RED, COLOR.BLUE, COLOR.GREEN]
            .map(async (color) => {
                const litigationKeyPair = Encryption.generateKeyPair(512);
                const litEncVertices = ImportUtilities.immutableEncryptVertices(
                    vertices,
                    litigationKeyPair.privateKey,
                );

                ImportUtilities.sort(litEncVertices);
                const litigationBlocks = this.challengeService.getBlocks(litEncVertices);
                const litigationBlocksMerkleTree = new MerkleTree(litigationBlocks);
                const litRootHash = litigationBlocksMerkleTree.getRoot();

                const distributionKeyPair = Encryption.generateKeyPair(512);
                const distEncVertices = ImportUtilities.immutableEncryptVertices(
                    vertices,
                    distributionKeyPair.privateKey,
                );
                const distMerkleStructure = await ImportUtilities.merkleStructure(
                    distEncVertices,
                    edges,
                );
                const distRootHash = distMerkleStructure.tree.getRoot();

                const distEpk = Encryption.packEPK(distributionKeyPair.publicKey);
                const distributionEpkChecksum = Encryption.calculateDataChecksum(distEpk, 0, 0, 0);

                const replication = {
                    color,
                    edges,
                    litigationVertices: litEncVertices,
                    litigationPublicKey: litigationKeyPair.publicKey,
                    litigationPrivateKey: litigationKeyPair.privateKey,
                    distributionPublicKey: distributionKeyPair.publicKey,
                    distributionPrivateKey: distributionKeyPair.privateKey,
                    distributionEpkChecksum,
                    litigationRootHash: litRootHash,
                    distributionRootHash: distRootHash,
                    distributionEpk: distEpk,
                };

                that.replicationCache[internalOfferId][color] = replication;
                return replication;
            }));
    }

    /**
     * Casts color to number
     * @param color
     */
    castColorToNumber(color) {
        switch (color.toLowerCase()) {
        case COLOR.RED:
            return new BN(0, 10);
        case COLOR.GREEN:
            return new BN(1, 10);
        case COLOR.BLUE:
            return new BN(2, 10);
        default:
            throw new Error(`Failed to cast color ${color}`);
        }
    }

    /**
     * Replications cleanup (delete dir, purge cache)
     * @param internalOfferId
     * @return {Promise<void>}
     */
    async cleanup(internalOfferId) {
        delete this.replicationCache[internalOfferId];

        this.logger.info(`Deleting replications directory and cache for offer with internal ID ${internalOfferId}`);
        const offerDirPath = this._getOfferDirPath(internalOfferId);
        await Utilities.deleteDirectory(offerDirPath);
    }

    /**
     * Save single replication
     * @param color
     * @param data
     * @param internalOfferId
     */
    async saveReplication(internalOfferId, color, data) {
        this.replicationCache[internalOfferId][color] = data;

        const offerDirPath = this._getOfferDirPath(internalOfferId);
        await Utilities.writeContentsToFile(offerDirPath, `${color}.json`, JSON.stringify(data, null, 2));
    }

    /**
     * Load replication from cache or file
     * @param internalOfferId
     * @param color
     * @return {Promise<*>}
     */
    async loadReplication(internalOfferId, color) {
        let data;
        if (this.replicationCache[internalOfferId]) {
            data = this.replicationCache[internalOfferId][color];
        }

        if (data) {
            this.logger.trace(`Loaded replication from cache for offer internal ID ${internalOfferId} and color ${color}`);
            return data;
        }

        const offerDirPath = this._getOfferDirPath(internalOfferId);
        const colorFilePath = path.join(offerDirPath, `${color}.json`);

        this.logger.trace(`Loaded replication from file for offer internal ID ${internalOfferId} and color ${color}`);
        return JSON.parse(await Utilities.fileContents(colorFilePath));
    }

    /**
     * Gets offer directory
     * @param internalOfferId
     * @returns {string}
     */
    _getOfferDirPath(internalOfferId) {
        return path.join(
            this.config.appDataPath,
            this.config.dataSetStorage, internalOfferId,
        );
    }
}

module.exports = ReplicationService;
