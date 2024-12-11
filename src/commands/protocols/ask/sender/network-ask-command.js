import NetworkProtocolCommand from '../../common/network-protocol-command.js';
import { ERROR_TYPE, OPERATION_ID_STATUS } from '../../../../constants/constants.js';

class NetworkAskCommand extends NetworkProtocolCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.askService;
        this.ualService = ctx.ualService;

        this.errorType = ERROR_TYPE.ASK.ASK_NETWORK_ERROR;
        this.operationStartEvent = OPERATION_ID_STATUS.ASK.ASK_NETWORK_START;
        this.operationEndEvent = OPERATION_ID_STATUS.ASK.ASK_NETWORK_END;
        this.getBatchSizeStartEvent = OPERATION_ID_STATUS.ASK.ASK_NETWORK_GET_BATCH_SIZE_START;
        this.getBatchSizeEndEvent = OPERATION_ID_STATUS.ASK.ASK_NETWORK_GET_BATCH_SIZE_END;
    }

    /**
     * Builds default networkGetCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'networkAskCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default NetworkAskCommand;
