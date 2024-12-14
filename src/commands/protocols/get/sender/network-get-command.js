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
