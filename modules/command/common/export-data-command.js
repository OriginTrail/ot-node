const Command = require('../command');
const Models = require('../../../models');
const Utilities = require('../../Utilities');
const ImportUtilities = require('../../ImportUtilities');
const fs = require('fs');
const path = require('path');
/**
 * Retrieves data from the Graph Database for export and stores it in a cache file
 * Fetches the dataset metadata and stores it in the handler data
 */
class ExportDataCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.importService = ctx.importService;
        this.config = ctx.config;
    }

    async execute(command) {
        const {
            datasetId,
            handlerId,
        } = command.data;

        const fileContent = await this.importService.getImportDbData(datasetId);
        const cacheDirectory = path.join(this.config.appDataPath, 'export_cache');

        await Utilities.writeContentsToFile(
            cacheDirectory,
            handlerId,
            JSON.stringify(fileContent),
        );

        const dataInfo = await Models.data_info.findOne({ where: { data_set_id: datasetId } });

        const handler = await Models.handler_ids.findOne({
            where: { handler_id: handlerId },
        });

        const data = JSON.parse(handler.data);
        if (dataInfo.root_hash) {
            data.root_hash = dataInfo.root_hash;
        }
        data.data_hash = dataInfo.data_hash;
        data.replication_info = await ImportUtilities
            .getReplicationInfo(dataInfo.data_set_id, dataInfo.origin);
        data.data_creators = fileContent.metadata.dataCreator;
        data.signature = fileContent.metadata.signature;

        await Models.handler_ids.update(
            { data: JSON.stringify(data) },
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

        const cacheDirectory = path.join(this.config.appDataPath, 'export_cache');
        const filePath = path.join(cacheDirectory, handlerId);

        if (fs.existsSync(filePath)) {
            await Utilities.deleteDirectory(filePath);
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
