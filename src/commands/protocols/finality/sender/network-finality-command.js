import NetworkProtocolCommand from '../../common/network-protocol-command.js';
import {
    COMMAND_PRIORITY,
    ERROR_TYPE,
    OPERATION_ID_STATUS,
} from '../../../../constants/constants.js';

class NetworkFinalityCommand extends NetworkProtocolCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.finalityService;
        this.ualService = ctx.ualService;

        this.errorType = ERROR_TYPE.FINALITY.FINALITY_NETWORK_ERROR;
        this.operationStartEvent = OPERATION_ID_STATUS.FINALITY.FINALITY_NETWORK_START;
        this.operationEndEvent = OPERATION_ID_STATUS.FINALITY.FINALITY_NETWORK_END;
    }

    /**
     * Builds default networkFinalityCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'networkFinalityCommand',
            delay: 0,
            transactional: false,
            priority: COMMAND_PRIORITY.HIGHEST,
        };
        Object.assign(command, map);
        return command;
    }
}

export default NetworkFinalityCommand;
