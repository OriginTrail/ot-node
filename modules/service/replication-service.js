const Encryption = require('../Encryption');
const ImportUtilities = require('../ImportUtilities');
const MerkleTree = require('../Merkle');
const Challenge = require('../Challenge');

const Models = require('../../models/index');

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

        return Promise.all([COLOR.RED, COLOR.BLUE, COLOR.GREEN]
            .map(async (color) => {
                const litigationKeyPair = Encryption.generateKeyPair(512);
                const litEncVertices = ImportUtilities.immutableEncryptVertices(
                    vertices,
                    litigationKeyPair.privateKey,
                );

                ImportUtilities.sort(litEncVertices);
                const litigationBlocks = Challenge.getBlocks(litEncVertices, 32);
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

                return {
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
            }));
    }
}

module.exports = ReplicationService;
