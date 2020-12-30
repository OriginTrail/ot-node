const bytes = require('utf8-length');
const fs = require('fs');
const { sha3_256 } = require('js-sha3');
const Command = require('../command');
const Encryption = require('../../RSAEncryption');
const Utilities = require('../../Utilities');
const Models = require('../../../models/index');
const { fork } = require('child_process');

/**
 * Imports data for replication
 */
class DhReplicationImportCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.importService = ctx.importService;
        this.permissionedDataService = ctx.permissionedDataService;
        this.graphStorage = ctx.graphStorage;
        this.logger = ctx.logger;
        this.transport = ctx.transport;
        this.remoteControl = ctx.remoteControl;
        this.blockchain = ctx.blockchain;
        this.challengeService = ctx.challengeService;
        this.profileService = ctx.profileService;
        this.commandExecutor = ctx.commandExecutor;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            offerId,
            blockchain_id,
            dataSetId,
            documentPath,
            dcWallet,
            dcNodeId,
            litigationPublicKey,
            litigationRootHash,
            distributionPublicKey,
            distributionPrivateKey,
            distributionEpk,
            transactionHash,
            encColor,
            dcIdentity,
        } = command.data;

        const blockchainRootHash = await this
            .blockchain.getRootHash(dataSetId, blockchain_id).response;
        const forked = fork('modules/worker/validate-received-replication-worker.js');
        this.logger.info('Validation of received replication started.');
        forked.send(JSON.stringify({
            documentPath,
            litigationPublicKey,
            offerId,
            encColor,
            dataSetId,
            blockchainRootHash,
            litigationRootHash,
        }));

        forked.on('message', async (response) => {
            if (response.error) {
                throw new Error(response.error);
            } else {
                const {
                    dataHash,
                    decryptedDataset,
                    permissionedData,
                    encryptedMap,
                    decryptedGraphRootHash,
                } = response;
                this.logger.info('Replication data is valid. Replication data import started.');
                this.permissionedDataService.attachPermissionedDataToGraph(
                    decryptedDataset['@graph'],
                    permissionedData,
                );

                const holdingData = await Models.holding_data.findOne({
                    where: {
                        offer_id: offerId,
                        data_set_id: dataSetId,
                        color: encColor,
                        source_wallet: dcWallet,
                    },
                });

                if (holdingData == null) {
                    // Store holding information and generate keys for eventual data replication.
                    const newHoldingEntry = {
                        data_set_id: dataSetId,
                        source_wallet: dcWallet,
                        litigation_public_key: litigationPublicKey,
                        litigation_root_hash: litigationRootHash,
                        distribution_public_key: distributionPublicKey,
                        distribution_private_key: distributionPrivateKey,
                        distribution_epk: distributionEpk,
                        transaction_hash: transactionHash,
                        color: encColor,
                        offer_id: offerId,
                    };
                    await Models.holding_data.create(newHoldingEntry);
                }

                const dataInfo = await Models.data_info.findOne({
                    where: {
                        data_set_id: dataSetId,
                    },
                });
                await this.permissionedDataService.addDataSellerForPermissionedData(
                    dataSetId,
                    dcIdentity,
                    blockchain_id,
                    0,
                    dcNodeId,
                    decryptedDataset['@graph'],
                );

                const importResult = await this.importService.importFile({
                    document: decryptedDataset,
                    encryptedMap,
                    blockchain_id,
                });
                this.logger.info('Replication data import finalized.');
                const data_provider_wallets = importResult.wallets;
                fs.unlinkSync(documentPath);

                if (importResult.error) {
                    throw Error(importResult.error);
                }

                if (dataInfo == null) {
                    const dataSize = bytes(JSON.stringify(decryptedDataset));
                    await Models.data_info.create({
                        data_set_id: dataSetId,
                        total_documents: decryptedDataset['@graph'].length,
                        root_hash: decryptedGraphRootHash,
                        // TODO: add field data_provider_id: 'Perutnina Ptuj ERC...'
                        // otjson.datasetHeader.dataProvider || 'Unknown'
                        // TODO: add field data_provider_id_type: 'ERC725' || 'Unknown'
                        // TODO: add field data_creator_id: otjson.datasetHeader.dataCreator
                        // TODO: add field data_creator_id_type: 'ERC725' || 'Unknown'
                        data_provider_wallets: JSON.stringify(data_provider_wallets),
                        import_timestamp: new Date(),
                        otjson_size_in_bytes: dataSize,
                        data_hash: dataHash,
                        origin: 'HOLDING',
                    });
                }
                this.logger.important(`[DH] Replication finished for offer_id ${offerId}`);

                const toSign = [
                    Utilities.denormalizeHex(offerId),
                    Utilities.denormalizeHex(this.profileService.getIdentity(blockchain_id)),
                ];

                const { node_wallet, node_private_key } =
                    this.blockchain.getWallet(blockchain_id).response;

                const messageSignature = Encryption
                    .signMessage(toSign, Utilities.normalizeHex(node_private_key));

                const replicationFinishedMessage = {
                    offerId,
                    dhIdentity: Utilities
                        .denormalizeHex(this.profileService.getIdentity(blockchain_id)),
                    messageSignature: messageSignature.signature,
                    wallet: node_wallet,
                };

                await this.transport.replicationFinished(replicationFinishedMessage, dcNodeId);
                const bid = await Models.bids.findOne({ where: { offer_id: offerId } });
                bid.status = 'REPLICATED';
                await bid.save({ fields: ['status'] });

                this.logger.info(`Sent replication finished message for offer_id ${offerId} to node ${dcNodeId}`);
                await this.commandExecutor.add({
                    name: 'dhOfferFinalizedCommand',
                    deadline_at: Date.now() + (60 * 60 * 1000), // One hour.
                    period: 10 * 1000,
                    data: {
                        offerId,
                        blockchain_id,
                    },
                });
            }
            forked.kill();
        });
        return Command.empty();
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
