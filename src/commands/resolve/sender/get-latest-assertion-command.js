const Command = require('../../command');
const { ERROR_TYPE, HANDLER_ID_STATUS } = require('../../../constants/constants');

class GetLatestAssertionIdCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        let { id } = command.data;
        const { handlerId } = command.data;

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.RESOLVE.GETTING_LATEST_ASSERTION_ID,
        );

        if (id.startsWith('dkg://')) {
            const { assertionId } = await this.blockchainModuleManager.getAssetProofs(
                id.split('/').pop(),
            );
            if (assertionId) {
                id = assertionId;
            }
        }

        const commandData = command.data;
        commandData.assertionId = id;

        return this.continueSequence(commandData, command.sequence);
    }

    handleError(handlerId, error, msg) {
        this.logger.error({
            msg,
            Operation_name: 'Error',
            Event_name: ERROR_TYPE.GET_ASSERTION_COMMAND,
            Event_value1: error.message,
            Id_operation: handlerId,
        });
    }

    /**
     * Builds default getLatestAssertionIdCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'getLatestAssertionIdCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = GetLatestAssertionIdCommand;
