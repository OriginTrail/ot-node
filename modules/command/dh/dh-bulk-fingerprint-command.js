const Command = require('../command');
const Models = require('../../../models');
const fs = require('fs');
const path = require('path');
const Utilities = require('../../Utilities');
const constants = require('../../constants');

class DvBulkFingerprintCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.dhService = ctx.dhService;
        this.config = ctx.config;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            handler_id,
            dataset_ids,
        } = command.data;

        const response = [];

        for (const dataset_id of dataset_ids) {
            // eslint-disable-next-line no-await-in-loop
            const { result } = await this.dhService.getFingerprintData(dataset_id);
            response.push({ dataset_id, fingerprint_data: result });
        }

        try {
            const cacheDirectory = path.join(
                this.config.appDataPath,
                constants.TRAIL_CACHE_DIRECTORY,
            );
            await Utilities.writeContentsToFile(
                cacheDirectory,
                handler_id,
                JSON.stringify(response),
            );

            await Models.handler_ids.update(
                {
                    status: 'COMPLETED',
                },
                {
                    where: {
                        handler_id,
                    },
                },
            );

            this.logger.info(`Get bulk fingerprint completed for handler_id: ${handler_id}`);
        } catch (error) {
            const cacheDirectory = path.join(
                this.config.appDataPath,
                constants.TRAIL_CACHE_DIRECTORY,
            );
            const filePath = path.join(cacheDirectory, handler_id);

            if (fs.existsSync(filePath)) {
                await Utilities.deleteDirectory(filePath);
            }
            await this.handleError(handler_id, error);
        }

        return Command.empty();
    }

    async handleError(handlerId, error) {
        this.logger.error(`Failed to get fingerprints for handler_id: ${handlerId}, error: ${error}`);
        await Models.handler_ids.update(
            {
                data: JSON.stringify({ message: error.message }),
                status: 'FAILED',
            },
            {
                where: {
                    handler_id: handlerId,
                },
            },
        );
    }

    async recover(command, error) {
        const { handler_id } = command.data;
        console.log('recover');
        await this.handleError(handler_id, error);
        return Command.empty();
    }

    /**
     * Builds default dcMerkleProofsCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhBulkFingerprintCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DvBulkFingerprintCommand;
