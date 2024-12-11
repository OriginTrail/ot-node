import ProtocolScheduleMessagesCommand from '../../common/protocol-schedule-messages-command.js';
import { OPERATION_ID_STATUS, ERROR_TYPE } from '../../../../constants/constants.js';

class AskScheduleMessagesCommand extends ProtocolScheduleMessagesCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.askService;

        this.errorType = ERROR_TYPE.ASK.ASK_ERROR;
        this.operationStartEvent = OPERATION_ID_STATUS.ASK.ASK_FETCH_FROM_NODES_START;
        this.operationEndEvent = OPERATION_ID_STATUS.ASK.ASK_FETCH_FROM_NODES_END;
    }

    getNextCommandData(command) {
        return {
            ...super.getNextCommandData(command),
            ual: command.data.ual,
            operationId: command.data.operationId,
            minimumNumberOfNodeReplications: command.data.minimumNumberOfNodeReplications,
        };
    }

    /**
     * Builds default askScheduleMessagesCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'askScheduleMessagesCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default AskScheduleMessagesCommand;
