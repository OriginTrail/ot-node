const Command = require('../command');
const Models = require('../../../models');
const Utilities = require('../../Utilities');

class DcMerkleProofsCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.importService = ctx.importService;
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
                throw new Error('Bad request');
            }

            const { object_ids, dataset_id } = obj;
            promises.push(this.importService
                .getMerkleProofs(Utilities.arrayze(object_ids), dataset_id));
        }

        let response = await Promise.all(promises);
        response = Array.prototype.concat.apply([], response);

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
        this.logger.error(`Failed to get merkle proofs for handler_id: ${handlerId}, error: ${error}`);
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
            name: 'dcMerkleProofsCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DcMerkleProofsCommand;
