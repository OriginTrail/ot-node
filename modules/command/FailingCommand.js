const Models = require('../../models');
const CommandHandler = require('./Command');

class FailingCommand extends CommandHandler {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
    }

    /**
     * Executes ADD operation
     * @param event
     * @param transaction
     */
    async execute(event, transaction) {
        await Models.node_config.create({
            key: 'key',
            value: 'test',
        }, {
            transaction,
        });
        await Models.node_config.create({
            key: 'key',
            value: 'test',
        }, {
            transaction,
        });
        await Models.node_config.create({
            key: 'key',
            value: 'test',
        }, {
            transaction,
        });

        throw new Error('fail');
    }

    /**
     * Recover system from failure
     * @param event
     * @param transaction
     * @param err
     */
    async recover(event, err, transaction) {
        this.logger.warn('FailingCommand failed. Trying to recover.');
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    static buildDefault(map) {
        const command = {
            name: 'failing',
            delay: 0,
            deadline: Date.now() + 10000,
            transactional: true,
            retries: 3,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = FailingCommand;
