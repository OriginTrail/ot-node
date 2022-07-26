const ProtocolScheduleMessagesCommand = require('../../common/protocol-schedule-messages-command');
const { HANDLER_ID_STATUS, ERROR_TYPE } = require('../../../../constants/constants');

class GetScheduleMessagesCommand extends ProtocolScheduleMessagesCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.getService;

        this.errorType = ERROR_TYPE.GET.GET_START_ERROR;
        this.startEvent = HANDLER_ID_STATUS.GET.GET_FETCH_FROM_NODES_START;
    }

    getNextCommandData(command) {
        const { ual, assertionId } = command.data;
        return {
            ual,
            assertionId,
        };
    }

    /**
     * Builds default getScheduleMessagesCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'getScheduleMessagesCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = GetScheduleMessagesCommand;
