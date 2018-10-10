const path = require('path');

const MerkleTree = require('../../Merkle');
const Utilities = require('../../Utilities');
const Challenge = require('../../Challenge');
const Encryption = require('../../Encryption');
const ImportUtilities = require('../../ImportUtilities');

const Command = require('../command');

/**
 * Supported versions of the same data set
 * @type {{RED: string, BLUE: string, GREEN: string}}
 */
const COLOR = {
    RED: 'red',
    BLUE: 'blue',
    GREEN: 'green',
};

/**
 * Prepare offer parameters (litigation/distribution hashes, etc.)
 */
class DCOfferPrepareCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.graphStorage = ctx.graphStorage;
    }

    /**
     * Creates an offer in the database
     * @param command
     * @returns {Promise<{commands}>}
     */
    async execute(command) {
        const {
            internalOfferId,
            dataSetId,
        } = command.data;

        const [edges, vertices] = await Promise.all([
            this.graphStorage.findEdgesByImportId(dataSetId),
            this.graphStorage.findVerticesByImportId(dataSetId),
        ]);

        const distLitRootHashes = (await Promise.all([COLOR.RED, COLOR.BLUE, COLOR.GREEN]
            .map(async (color) => {
                const colorDirPath = path.join(
                    this.config.appDataPath,
                    this.config.dataSetStorage, internalOfferId,
                );

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

                const colorInfo = {
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
                await Utilities.writeContentsToFile(
                    colorDirPath, `${color}.json`,
                    JSON.stringify(colorInfo, null, 2),
                );

                const hashes = {};
                hashes[`${color}LitigationHash`] = litRootHash;
                hashes[`${color}DistributionHash`] = distRootHash;
                return hashes;
            }))).reduce((acc, value) => Object.assign(acc, value));

        const { data } = command;
        Object.assign(data, distLitRootHashes);
        return this.continueSequence(data, command.sequence);
    }

    /**
     * Builds default dcOfferPrepareCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcOfferPrepareCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCOfferPrepareCommand;
