import NetworkProtocolCommand from '../../common/network-protocol-command.js';
import { ERROR_TYPE, OPERATION_ID_STATUS } from '../../../../constants/constants.js';

class NetworkUpdateCommand extends NetworkProtocolCommand {
    constructor(ctx) {
        super(ctx);
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.ualService = ctx.ualService;
        this.operationService = ctx.updateService;

        this.errorType = ERROR_TYPE.UPDATE.UPDATE_NETWORK_START_ERROR;
        this.operationStartEvent = OPERATION_ID_STATUS.UPDATE.UPDATE_NETWORK_START;
        this.operationEndEvent = OPERATION_ID_STATUS.UPDATE.UPDATE_NETWORK_END;
    }

    /**
     * Builds default networkUpdateCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'networkUpdateCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default NetworkUpdateCommand;
