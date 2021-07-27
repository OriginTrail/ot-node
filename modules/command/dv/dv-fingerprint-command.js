const Command = require('../command');
const Models = require('../../../models');

class DvFingerprintCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.dvService = ctx.dvService;
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
            const { result } = await this.dvService.getFingerprintData(dataset_id);
            response.push({ dataset_id, fingerprint_data: result });
        }

        await Models.handler_ids.update(
            {
                status: 'COMPLETED',
                data: JSON.stringify(response),
            },
            {
                where: {
                    handler_id,
                },
            },
        );

        return Command.empty();
    }

    async recover(command, error) {
        const { handlerId } = command.data;
        this.logger.error(`Failed to get fingerprints for handler_id: ${handlerId}, error: ${error}`);
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
        return Command.empty();
    }

    /**
     * Builds default dcMerkleProofsCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dvFingerprintCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DvFingerprintCommand;
