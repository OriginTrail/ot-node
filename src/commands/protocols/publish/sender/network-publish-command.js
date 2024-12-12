import NetworkProtocolCommand from '../../common/network-protocol-command.js';
import { ERROR_TYPE, OPERATION_ID_STATUS } from '../../../../constants/constants.js';

class NetworkPublishCommand extends NetworkProtocolCommand {
    constructor(ctx) {
        super(ctx);
        this.blockchainModuleManager = ctx.blockchainModuleManager; // this should be removed (???)
        this.ualService = ctx.ualService; // this should be removed (???)
        this.operationService = ctx.publishService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_NETWORK_START_ERROR;
        this.operationStartEvent = OPERATION_ID_STATUS.PUBLISH.PUBLISH_NETWORK_START;
        this.operationEndEvent = OPERATION_ID_STATUS.PUBLISH.PUBLISH_NETWORK_END;
    }

    /**
     * Builds default networkPublishCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'networkPublishCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default NetworkPublishCommand;
