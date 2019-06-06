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
        // const {
        //     offerId,
        //     dataSetId,
        //     edges,
        //     litigationVertices,
        //     litigationPublicKey,
        //     distributionPublicKey,
        //     distributionPrivateKey,
        //     distributionEpk,
        //     distributionEpkChecksum,
        //     dcWallet,
        //     dcNodeId,
        //     litigationRootHash,
        //     distributionRootHash,
        //     distributionSignature,
        //     transactionHash,
        //     encColor,
        // } = command.data;
        const {
            offerId,
            dataSetId,
            otjson,
            dcWallet,
            dcNodeId,
            litigationPublicKey,
            litigationRootHash,
            distributionPublicKey,
            distributionPrivateKey,
            distributionEpk,
            transactionHash,
            encColor,
        } = command.data;
        const { decryptedDataset, encryptedMap } =
            await ImportUtilities.decryptDataset(otjson, litigationPublicKey);
        const calculatedDataSetId =
            await ImportUtilities.calculateGraphHash(decryptedDataset['@graph']);

        if (dataSetId !== calculatedDataSetId) {
            throw new Error(`Calculated data set ID ${calculatedDataSetId} differs from DC data set ID ${dataSetId}`);
        }

        const decryptedGraphRootHash = ImportUtilities.calculateDatasetRootHash(decryptedDataset);

        // Verify litigation root hash
        const encryptedGraphRootHash = ImportUtilities.calculateDatasetRootHash(otjson);

        if (encryptedGraphRootHash !== litigationRootHash) {
            throw Error(`Calculated distribution hash ${encryptedGraphRootHash} differs from DC distribution hash ${litigationRootHash}`);
        }

        // TODO: Verify decrypted data root hash
        // TODO: Verify EPK checksum
        // TODO: Verify distribution keys and hashes
        // TODO: Verify data creator id

        const holdingData = await Models.holding_data.findOne({
            where: {
                data_set_id: dataSetId,
                color: encColor,
                source_wallet: dcWallet,
            },
        });

        if (holdingData == null) {
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
        }

        const dataInfo = await Models.data_info.findOne({
            where: {
                data_set_id: dataSetId,
            },
        });

        if (dataInfo == null) {
            const importResult = await this.importer.importOTJSON(decryptedDataset, encryptedMap);

            if (importResult.error) {
                throw Error(importResult.error);
            }

            const dataSize = bytes(JSON.stringify(otjson));
            await Models.data_info.create({
                data_set_id: dataSetId,
                total_documents: otjson['@graph'].length,
                root_hash: decryptedGraphRootHash,
                // TODO: add field data_provider_id: 'Perutnina Ptuj ERC...' otjson.datasetHeader.dataProvider || 'Unknown'
                // TODO: add field data_provider_id_type: 'ERC725' || 'Unknown'
                // TODO: add field data_creator_id: otjson.datasetHeader.dataCreator
                // TODO: add field data_creator_id_type: 'ERC725' || 'Unknown'
                data_provider_wallet: dcWallet, // TODO: rename to data_creator_wallet
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
