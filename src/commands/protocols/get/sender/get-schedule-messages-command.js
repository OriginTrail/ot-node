import ProtocolScheduleMessagesCommand from '../../common/protocol-schedule-messages-command.js';
import { OPERATION_ID_STATUS, ERROR_TYPE } from '../../../../constants/constants.js';

class GetScheduleMessagesCommand extends ProtocolScheduleMessagesCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.getService;

        this.errorType = ERROR_TYPE.GET.GET_START_ERROR;
        this.startEvent = OPERATION_ID_STATUS.GET.GET_FETCH_FROM_NODES_START;
    }

    getNextCommandData(command) {
        return {
            ...super.getNextCommandData(command),
            ual: command.data.ual,
            assetSync: command.data.assetSync,
            paranetSync: command.data.paranetSync,
            paranetTokenId: command.data.paranetTokenId,
            paranetLatestAsset: command.data.paranetLatestAsset,
            paranetUAL: command.data.paranetUAL,
            paranetId: command.data.paranetId,
            paranetMetadata: command.data.paranetMetadata,
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

export default GetScheduleMessagesCommand;
