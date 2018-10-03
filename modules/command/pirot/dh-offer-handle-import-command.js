const bytes = require('utf8-length');

const Command = require('../command');
const Utilities = require('../../Utilities');
const Models = require('../../../models/index');

/**
 * Imports data for replication
 */
class DHOfferHandleImportCommand extends Command {
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
            vertices,
            edges,
            dcWallet,
            dcNodeId,
            publicKey,
        } = command.data;

        let importResult = await this.importer.importJSON({
            dataSetId,
            vertices,
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

        const message = {
            offerId,
            wallet: this.config.node_wallet,
        };
        const replicationFinishedMessage = {
            message,
            messageSignature: Utilities.generateRsvSignature(
                JSON.stringify(message),
                this.web3,
                this.config.node_private_key,
            ),
        };

        await this.transport.replicationFinished(replicationFinishedMessage, dcNodeId);
        this.logger.info(`Replication request for ${offerId} sent to ${dcNodeId}`);
        return Command.empty();
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhOfferHandleImportCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHOfferHandleImportCommand;
