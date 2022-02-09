const Command = require('../command');
const Models = require('../../../models/index');
const constants = require('../../constants');

class InsertAssertionCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.dataService = ctx.dataService;
        this.fileService = ctx.fileService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { documentPath, handlerId } = command.data;
        let { nquads, assertion } = await this.fileService.loadJsonFromFile(documentPath);

        try {
            // TODO Store to local graph database
            await this.dataService.insert(nquads.join('\n'), `${constants.DID_PREFIX}:${assertion.id}`);
            this.logger.info(`Assertion ${assertion.id} has been successfully inserted`);
            await Models.handler_ids.update(
                {
                    status: 'COMPLETED',
                }, {
                    where: {
                        handler_id: handlerId,
                    },
                },
            );
        } catch (e) {
            await this.handleError(handlerId, e, constants.ERROR_TYPE.INSERT_ASSERTION_ERROR, true);
        }

        return this.continueSequence(command.data, command.sequence);
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const {
            handlerId,
        } = command.data;
        await this.handleError(handlerId, err, constants.ERROR_TYPE.INSERT_ASSERTION_ERROR, true);

        return Command.empty();
    }

    /**
     * Builds default insertAssertionCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'insertAssertionCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = InsertAssertionCommand;
