const Command = require('../../command');
const constants = require('../../../constants/constants');

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
        const { documentPath, handlerId, operationId } = command.data;

        this.logger.emit({
            msg: 'Started measuring execution of storing publishing data into local triple store',
            Event_name: 'publish_local_store_start',
            Operation_name: 'publish_local_store',
            Id_operation: operationId,
        });
        const { nquads, assertion } = await this.fileService.loadJsonFromFile(documentPath);

        try {
            await this.dataService.insert(nquads.join('\n'), `${constants.DID_PREFIX}:${assertion.id}`);
            this.logger.info(`Assertion ${assertion.id} has been successfully inserted`);
            this.logger.emit({
                msg: 'Finished measuring execution of storing publishing data into local triple store',
                Event_name: 'publish_local_store_end',
                Operation_name: 'publish_local_store',
                Id_operation: operationId,
            });
        } catch (e) {
            await this.handleError(handlerId, e, constants.ERROR_TYPE.INSERT_ASSERTION_ERROR, true);
            return Command.empty();
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
