import ProtocolScheduleMessagesCommand from '../../common/protocol-schedule-messages-command.js';
import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    COMMAND_PRIORITY,
} from '../../../../constants/constants.js';

class FinalityScheduleMessagesCommand extends ProtocolScheduleMessagesCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.finalityService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.operationStartEvent = OPERATION_ID_STATUS.FINALITY.FINALITY_REPLICATE_START;
        this.operationEndEvent = OPERATION_ID_STATUS.FINALITY.FINALITY_REPLICATE_END;
        this.errorType = ERROR_TYPE.FINALITY.FINALITY_START_ERROR;
    }

    getNextCommandData(command) {
        return {
            ...super.getNextCommandData(command),
            ual: command.data.ual,
            publishOperationId: command.data.publishOperationId,
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
            priority: COMMAND_PRIORITY.HIGHEST,
        };
        Object.assign(command, map);
        return command;
    }
}

export default FinalityScheduleMessagesCommand;
