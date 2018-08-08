const Models = require('../../../models/index');
const Command = require('../command');
const Utilities = require('../../Utilities');
const ImportUtilities = require('../../ImportUtilities');
const Graph = require('../../Graph');
const Challenge = require('../../Challenge');
const Encryption = require('../../Encryption');
const MerkleTree = require('../../Merkle');

/**
 * Verifies DH keys created during replication
 */
class DCOfferKeyVerificationCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.network = ctx.network;
        this.blockchain = ctx.blockchain;
        this.graphStorage = ctx.graphStorage;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            dhNodeId, importId, encryptionKey, dhWallet, epk,
        } = command.data;

        const replicatedData = await Models.replicated_data.findOne({
            where: { dh_id: dhNodeId, import_id: importId },
        });

        const edgesPromise = this.graphStorage.findEdgesByImportId(importId);
        const verticesPromise = this.graphStorage.findVerticesByImportId(importId);

        const values = await Promise.all([edgesPromise, verticesPromise]);
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

        const escrow = await this.blockchain.getEscrow(importId, dhWallet);

        let failed = false;
        if (escrow.distribution_root_hash !== Utilities.normalizeHex(distributionHash)) {
            this.logger.warn(`Distribution hash for import ${importId} and DH ${dhWallet} is incorrect`);
            failed = true;
        }

        if (escrow.litigation_root_hash !== Utilities.normalizeHex(litigationRootHash)) {
            this.logger.warn(`Litigation hash for import ${importId} and DH ${dhWallet} is incorrect`);
            failed = true;
        }

        if (!escrow.checksum === epkChecksum) {
            this.logger.warn(`Checksum for import ${importId} and DH ${dhWallet} is incorrect`);
            failed = true;
        }

        const decryptionKey = Encryption.unpadKey(Encryption.globalDecrypt(epk));
        const decryptedVertices = Graph.decryptVertices(vertices, decryptionKey);
        if (!ImportUtilities.compareDocuments(decryptedVertices, originalVertices)) {
            this.logger.warn(`Decryption key for import ${importId} and DH ${dhWallet} is incorrect`);
            failed = true;
        }

        if (failed) {
            return {
                commands: [
                    {
                        name: 'dcEscrowCancelCommand',
                        delay: 0,
                        data: { importId, dhWallet, dhNodeId },
                        transactional: false,
                    },
                ],
            };
        }
        return {
            commands: [
                {
                    name: 'dcEscrowVerifyCommand',
                    delay: 0,
                    data: { importId, dhWallet, dhNodeId },
                    transactional: false,
                },
            ],
        };
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcOfferKeyVerificationCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCOfferKeyVerificationCommand;
