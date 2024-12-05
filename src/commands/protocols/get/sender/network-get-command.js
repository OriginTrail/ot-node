import NetworkProtocolCommand from '../../common/network-protocol-command.js';
import { ERROR_TYPE, OPERATION_ID_STATUS } from '../../../../constants/constants.js';

class NetworkGetCommand extends NetworkProtocolCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.getService;
        this.ualService = ctx.ualService;

        this.errorType = ERROR_TYPE.GET.GET_NETWORK_ERROR;
        this.operationStartEvent = OPERATION_ID_STATUS.GET.GET_NETWORK_START;
        this.operationEndEvent = OPERATION_ID_STATUS.GET.GET_NETWORK_END;
        this.getBatchSizeStartEvent = OPERATION_ID_STATUS.GET.GET_NETWORK_GET_BATCH_SIZE_START;
        this.getBatchSizeEndEvent = OPERATION_ID_STATUS.GET.GET_NETWORK_GET_BATCH_SIZE_END;
        this.getMinAckResponseStartEvent =
            OPERATION_ID_STATUS.GET.GET_NETWORK_GET_MIN_ACK_RESPONSE_START;
        this.getMinAckResponseEndEvent =
            OPERATION_ID_STATUS.GET.GET_NETWORK_GET_MIN_ACK_RESPONSE_END;
    }

    /**
     * Builds default networkGetCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'networkGetCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default NetworkGetCommand;
