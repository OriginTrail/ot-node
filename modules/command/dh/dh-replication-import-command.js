const BN = require('../../../node_modules/bn.js/lib/bn');
const bytes = require('utf8-length');

const Command = require('../command');
const MerkleTree = require('../../Merkle');
const Encryption = require('../../Encryption');
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
        this.challengeService = ctx.challengeService;
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
            transactionHash,
            encColor,
        } = command.data;
        const decryptedVertices =
            await ImportUtilities.immutableDecryptVertices(litigationVertices, litigationPublicKey);
        const calculatedDataSetId =
            await ImportUtilities.importHash(dataSetId, decryptedVertices, edges);

        if (dataSetId !== calculatedDataSetId) {
            throw new Error(`Calculated data set ID ${calculatedDataSetId} differs from DC data set ID ${dataSetId}`);
        }

        ImportUtilities.sort(litigationVertices);
        const litigationBlocks = this.challengeService.getBlocks(litigationVertices);
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
        if (!Utilities.compareHexStrings(senderAddress, dcWallet)) {
            throw new Error(`Failed to validate DC ${dcWallet} signature for offer ${offerId}`);
        }

        const calculatedDistPublicKey = Encryption.unpackEPK(distributionEpk);
        ImportUtilities.immutableDecryptVertices(distEncVertices, calculatedDistPublicKey);

        const holdingData = await Models.holding_data.findOne({
            where: {
                data_set_id: dataSetId,
                color: encColor,
            },
        });

        if (holdingData == null) {
            // import does not exist

            await this.importer.importJSON({
                dataSetId,
                vertices: litigationVertices,
                edges,
                wallet: dcWallet,
            }, true, encColor);
        }

        // Store holding information and generate keys for eventual data replication.
        await Models.holding_data.create({
            data_set_id: dataSetId,
            source_wallet: dcWallet,
            litigation_public_key: litigationPublicKey,
            litigation_root_hash: litigationRootHash,
            distribution_public_key: distributionPublicKey,
            distribution_private_key: distributionPrivateKey,
            distribution_epk: distributionEpk,
            transaction_hash: transactionHash,
            color: encColor,
        });

        const dataInfo = await Models.data_info.findOne({
            where: {
                data_set_id: dataSetId,
            },
        });

        if (dataInfo == null) {
            let importResult = await this.importer.importJSON({
                dataSetId,
                vertices: decryptedVertices,
                edges,
                wallet: dcWallet,
            }, false);

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
                origin: 'HOLDING',
            });
        }
        this.logger.important(`[DH] Replication finished for offer ID ${offerId}`);

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
                    deadline_at: Date.now() + (60 * 60 * 1000), // One hour.
                    period: 10 * 1000,
                    data: {
                        offerId,
                    },
                },
            ],
        };
    }

    /**
     * Try to recover command
     * @param command
     * @param err
     * @return {Promise<{commands: *[]}>}
     */
    async recover(command, err) {
        const {
            offerId,
        } = command.data;

        const bid = await Models.bids.findOne({ where: { offer_id: offerId } });
        bid.status = 'FAILED';
        await bid.save({ fields: ['status'] });
        return Command.empty();
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
