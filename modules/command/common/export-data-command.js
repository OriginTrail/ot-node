const Command = require('../command');
const Models = require('../../../models');
const Utilities = require('../../Utilities');
const ImportUtilities = require('../../ImportUtilities');
const fs = require('fs');
const path = require('path');
/**
 * Increases approval for Bidding contract on blockchain
 */
class ExportDataCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.notifyError = ctx.notifyError;
        this.importService = ctx.importService;
        this.graphStorage = ctx.graphStorage;
        this.config = ctx.config;
    }

    async execute(command) {
        const {
            datasetId,
            handlerId,
        } = command.data;

        const fileContent = await this.importService.getImportDbData(datasetId);
        const cacheDirectory = path.join(this.config.appDataPath, 'export_cache');

        try {
            await Utilities.writeContentsToFile(
                cacheDirectory,
                handlerId,
                JSON.stringify(fileContent),
            );
        } catch (e) {
            const filePath = path.join(cacheDirectory, handlerId);

            if (fs.existsSync(filePath)) {
                await Utilities.deleteDirectory(filePath);
            }
            this.handleError(handlerId, `Error when creating export cache file for handler_id ${handlerId}. ${e.message}`);
            return Command.empty();
        }

        const dataInfo = await Models.data_info.findOne({ where: { data_set_id: datasetId } });
        const offer = await Models.offers.findOne({ where: { data_set_id: datasetId } });

        const handler = await Models.handler_ids.findOne({
            where: { handler_id: handlerId },
        });

        const data = JSON.parse(handler.data);
        data.root_hash = dataInfo.root_hash;
        data.data_hash = dataInfo.data_hash;
        data.transaction_hash = await ImportUtilities
            .getTransactionHash(dataInfo.data_set_id, dataInfo.origin);
        data.data_creator = fileContent.metadata.dataCreator;
        data.offer_id = offer !== null ? offer.offer_id : null;
        data.signature = fileContent.metadata.signature;
        handler.data = JSON.stringify(data);

        await Models.handler_ids.update(
            { data: handler.data },
            {
                where: {
                    handler_id: handlerId,
                },
            },
        );

        return this.continueSequence(command.data, command.sequence);
    }

    /**
     * Recover system from failure
     * @param command
     * @param error
     */
    async recover(command, error) {
        const { handlerId } = command.data;
        await this.handleError(handlerId, error);
        return Command.empty();
    }

    async handleError(handlerId, error) {
        this.logger.error(`Export failed for export handler_id: ${handlerId}, error: ${error}`);

        await Models.handler_ids.update(
            {
                status: 'FAILED',
                data: JSON.stringify({
                    error,
                }),
            },
            {
                where: {
                    handler_id: handlerId,
                },
            },
        );

        if (error.type !== 'ExporterError') {
            this.notifyError(error);
        }
    }

    /**
     * Builds default exportDataCommand command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'exportDataCommand',
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ExportDataCommand;
