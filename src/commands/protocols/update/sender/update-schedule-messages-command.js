import ProtocolScheduleMessagesCommand from '../../common/protocol-schedule-messages-command.js';
import { OPERATION_ID_STATUS, ERROR_TYPE } from '../../../../constants/constants.js';

class UpdateScheduleMessagesCommand extends ProtocolScheduleMessagesCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.updateService;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.operationStartEvent = OPERATION_ID_STATUS.UPDATE.UPDATE_REPLICATE_START;
        this.operationEndEvent = OPERATION_ID_STATUS.UPDATE.UPDATE_REPLICATE_END;
        this.errorType = ERROR_TYPE.UPDATE.UPDATE_START_ERROR;
    }

    /**
     * Builds default updateScheduleMessagesCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'updateScheduleMessagesCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default UpdateScheduleMessagesCommand;
