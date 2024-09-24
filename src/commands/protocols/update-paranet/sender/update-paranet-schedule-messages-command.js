import ProtocolScheduleMessagesCommand from '../../common/protocol-schedule-messages-command.js';
import { OPERATION_ID_STATUS, ERROR_TYPE } from '../../../../constants/constants.js';

class UpdateParanetScheduleMessagesCommand extends ProtocolScheduleMessagesCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.updateService;

        this.startEvent = OPERATION_ID_STATUS.UPDATE_PARANET.UPDATE_PARANET_REPLICATE_START;
        this.errorType = ERROR_TYPE.UPDATE_PARANET.UPDATE_PARANET_START_ERROR;
    }

    /**
     * Builds default updateParanetScheduleMessagesCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'updateParanetScheduleMessagesCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default UpdateParanetScheduleMessagesCommand;
