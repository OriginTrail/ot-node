const ProtocolScheduleMessagesCommand = require('../../common/protocol-schedule-messages-command');
const { HANDLER_ID_STATUS, ERROR_TYPE } = require('../../../../constants/constants');

class ResolveScheduleMessagesCommand extends ProtocolScheduleMessagesCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.resolveService;

        this.startEvent = HANDLER_ID_STATUS.RESOLVE.RESOLVE_FETCH_FROM_NODES_START;
    }

    getNextCommandData(command) {
        const { ual, assertionId } = command.data;
        return {
            ual,
            assertionId,
        };
    }

    /**
     * Builds default resolveScheduleMessagesCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'resolveScheduleMessagesCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.RESOLVE_START_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ResolveScheduleMessagesCommand;
