const Models = require('../../../models/index');
const Command = require('../command');

const bytes = require('utf8-length');

/**
 * Imports data for replication
 */
class DHOfferHandleImportCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.importer = ctx.importer;
        this.blockchain = ctx.blockchain;
        this.network = ctx.network;
        this.web3 = ctx.web3;
        this.graphStorage = ctx.graphStorage;
        this.logger = ctx.logger;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            importId,
            vertices,
            edges,
            dcWallet,
            publicKey,
        } = command.data;

        const bidModel = await Models.bids.findOne({ where: { import_id: importId } });
        if (!bidModel) {
            this.logger.warn(`Couldn't find bid for import ID ${importId}.`);
            return Command.empty();
        }
        let importResult = await this.importer.importJSON({
            import_id: importId,
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
            import_id: importResult.import_id,
            total_documents: importResult.vertices.length,
            root_hash: importResult.root_hash,
            data_provider_wallet: importResult.wallet,
            import_timestamp: new Date(),
            data_size: dataSize,
        });

        this.logger.trace(`[DH] Replication finished for ${importId}`);
        return {
            commands: [
                this.build('dhOfferReplicationParametersCommand', {
                    importId,
                    importResult,
                    publicKey,
                }, null),
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
            name: 'dhOfferHandleImportCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHOfferHandleImportCommand;
