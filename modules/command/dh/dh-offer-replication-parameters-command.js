const Graph = require('../../Graph');
const MerkleTree = require('../../Merkle');
const Encryption = require('../../Encryption');
const Challenge = require('../../Challenge');
const Utilities = require('../../Utilities');

const ImportUtilities = require('../../ImportUtilities');
const Command = require('../command');

/**
 * Generates DH replication parameters and writes them to blockchain
 */
class DHOfferReplicationParametersCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.blockchain = ctx.blockchain;
        this.graphStorage = ctx.graphStorage;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            importId, importResult, publicKey,
        } = command.data;

        const encryptedVertices = importResult.vertices.filter(vertex => vertex.vertex_type !== 'CLASS');
        ImportUtilities.sort(encryptedVertices);
        const litigationBlocks = Challenge.getBlocks(encryptedVertices, 32);
        const litigationBlocksMerkleTree = new MerkleTree(litigationBlocks);
        const litigationRootHash = litigationBlocksMerkleTree.getRoot();

        const keyPair = Encryption.generateKeyPair(512);
        const decryptedVertices = encryptedVertices.map((encVertex) => {
            if (encVertex.data) {
                encVertex.data = Encryption.decryptObject(encVertex.data, publicKey);
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

        this.logger.important('Send root hashes and checksum to blockchain.');
        this.remoteControl.sendingRootHashes('Sending import root hashes and checksum to blockchain.');
        await this.blockchain.addRootHashAndChecksum(
            importId,
            litigationRootHash,
            distributionHash,
            Utilities.normalizeHex(epkChecksum),
        );
        return {
            commands: [
                this.build('dhOfferReplicationParametersSaveCommand', {
                    importId,
                    publicKey,
                    distributionPublicKey: keyPair.publicKey,
                    distributionPrivateKey: keyPair.privateKey,
                    epk,
                }, null),
            ],
        };
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhOfferReplicationParametersCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHOfferReplicationParametersCommand;
