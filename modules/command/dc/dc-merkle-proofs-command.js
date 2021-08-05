const Command = require('../command');
const Models = require('../../../models');
const Utilities = require('../../Utilities');
const fs = require('fs');
const path = require('path');
const constants = require('../../constants');

class DcMerkleProofsCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.importService = ctx.importService;
        this.config = ctx.config;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            handler_id,
            objects,
        } = command.data;

        const promises = [];

        for (const obj of objects) {
            if (!obj.object_ids || !obj.dataset_id) {
                throw new Error('Bad request, dataset_id and object_ids are required');
            }

            const { object_ids, dataset_id } = obj;
            promises.push(this.importService
                .getMerkleProofs(Utilities.arrayze(object_ids), dataset_id));
        }

        let response = await Promise.all(promises);
        response = Array.prototype.concat.apply([], response);

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

            this.logger.info(`Get bulk merkle proofs completed for handler_id: ${handler_id}`);
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
            name: 'dcMerkleProofsCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DcMerkleProofsCommand;
