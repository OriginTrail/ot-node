import ProtocolScheduleMessagesCommand from '../../common/protocol-schedule-messages-command.js';
import { OPERATION_ID_STATUS, ERROR_TYPE } from '../../../../constants/constants.js';

class FinalityScheduleMessagesCommand extends ProtocolScheduleMessagesCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.finalityService;

        this.errorType = ERROR_TYPE.FINALITY.FINALITY_ERROR;
        this.startEvent = OPERATION_ID_STATUS.FINALITY.FINALITY_FETCH_FROM_NODES_START;
    }

    getNextCommandData(command) {
        return {
            ...super.getNextCommandData(command),
            ual: command.data.ual,
            operationId: command.data.operationId,
        };
    }

    /**
     * Builds default finalityScheduleMessagesCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'finalityScheduleMessagesCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default FinalityScheduleMessagesCommand;
