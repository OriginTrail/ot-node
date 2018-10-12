const BN = require('bn.js');
const bytes = require('utf8-length');

const Command = require('../command');
const MerkleTree = require('../../Merkle');
const Encryption = require('../../Encryption');
const Challenge = require('../../Challenge');
const Utilities = require('../../Utilities');
const Models = require('../../../models/index');
const ImportUtilities = require('../../ImportUtilities');

/**
 * Imports data for replication
 */
class DhReplicationImportCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.importer = ctx.importer;
        this.blockchain = ctx.blockchain;
        this.web3 = ctx.web3;
        this.graphStorage = ctx.graphStorage;
        this.logger = ctx.logger;
        this.transport = ctx.transport;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            offerId,
            dataSetId,
            edges,
            litigationVertices,
            litigationPublicKey,
            distributionPublicKey,
            distributionPrivateKey,
            distributionEpk,
            distributionEpkChecksum,
            dcWallet,
            dcNodeId,
            litigationRootHash,
            distributionRootHash,
            distributionSignature,
        } = command.data;
        const decryptedVertices =
            await ImportUtilities.immutableDecryptVertices(litigationVertices, litigationPublicKey);
        const calculatedDataSetId =
            await ImportUtilities.importHash(decryptedVertices, edges);

        if (dataSetId !== calculatedDataSetId) {
            throw new Error(`Calculated data set ID ${calculatedDataSetId} differs from DC data set ID ${dataSetId}`);
        }

        ImportUtilities.sort(litigationVertices);
        const litigationBlocks = Challenge.getBlocks(litigationVertices, 32);
        const litigationBlocksMerkleTree = new MerkleTree(litigationBlocks);
        const calculatedLitigationRootHash = litigationBlocksMerkleTree.getRoot();

        if (litigationRootHash !== calculatedLitigationRootHash) {
            throw new Error(`Calculated litigation hash ${calculatedLitigationRootHash} differs from DC litigation hash ${litigationRootHash}`);
        }

        const distEncVertices = ImportUtilities.immutableEncryptVertices(
            decryptedVertices,
            distributionPrivateKey,
        );
        const calculatedDistributionRootHash = (await ImportUtilities.merkleStructure(
            distEncVertices,
            edges,
        )).tree.getRoot();

        if (distributionRootHash !== calculatedDistributionRootHash) {
            throw new Error(`Calculated distribution hash ${calculatedLitigationRootHash} differs from DC distribution hash ${litigationRootHash}`);
        }

        const calculatedDistEpkChecksum = Encryption
            .calculateDataChecksum(distributionEpk, 0, 0, 0);
        if (distributionEpkChecksum !== calculatedDistEpkChecksum) {
            throw new Error(`Calculated distribution EPK checksum ${calculatedDistEpkChecksum} differs from DC distribution EPK checksum ${distributionEpkChecksum}`);
        }

        const toCheck = [
            Utilities.denormalizeHex(new BN(distributionEpkChecksum).toString('hex')),
            Utilities.denormalizeHex(distributionRootHash),
        ];
        const senderAddress = Encryption.extractSignerAddress(toCheck, distributionSignature);
        if (senderAddress.toUpperCase() !== dcWallet.toUpperCase()) {
            throw new Error(`Failed to validate DC ${dcWallet} signature for offer ${offerId}`);
        }

        const calculatedDistPublicKey = Encryption.unpackEPK(distributionEpk);
        ImportUtilities.immutableDecryptVertices(distEncVertices, calculatedDistPublicKey);

        let importResult = await this.importer.importJSON({
            dataSetId,
            vertices: litigationVertices,
            edges,
            wallet: dcWallet,
        }, true);

        if (importResult.error) {
            throw Error(importResult.error);
        }

        importResult = importResult.response;

        const dataSize = bytes(JSON.stringify(importResult.vertices));
        await Models.data_info.create({
            data_set_id: importResult.data_set_id,
            total_documents: importResult.vertices.length,
            root_hash: importResult.root_hash,
            data_provider_wallet: importResult.wallet,
            import_timestamp: new Date(),
            data_size: dataSize,
        });

        this.logger.trace(`[DH] Replication finished for offer ID ${offerId}`);

        const toSign = [
            Utilities.denormalizeHex(offerId),
            Utilities.denormalizeHex(this.config.erc725Identity)];
        const messageSignature = Encryption
            .signMessage(this.web3, toSign, Utilities.normalizeHex(this.config.node_private_key));

        const replicationFinishedMessage = {
            offerId,
            dhIdentity: this.config.erc725Identity,
            messageSignature: messageSignature.signature,
        };

        await this.transport.replicationFinished(replicationFinishedMessage, dcNodeId);
        this.logger.info(`Replication request for ${offerId} sent to ${dcNodeId}`);
        return {
            commands: [
                {
                    name: 'dhOfferFinalizedCommand',
                    data: {
                        offerId,
                    },
                },
            ],
        };
    }

    /**
     * Builds default
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhReplicationImportCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DhReplicationImportCommand;
