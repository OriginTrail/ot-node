import ProtocolRequestCommand from '../../../common/protocol-request-command.js';
import { NETWORK_MESSAGE_TIMEOUT_MILLS, ERROR_TYPE } from '../../../../../constants/constants.js';

class PublishfinalityAckCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishFinalityService;
        this.operationIdService = ctx.operationIdService;
        this.errorType = ERROR_TYPE.PUBLISH_FINALITY.PUBLISH_FINALITY_REQUEST_ERROR;
    }

    async prepareMessage(command) {
        const { ual, blockchain, operationId } = command.data;

        return { ual, blockchain, operationId };
    }

    messageTimeout() {
        return NETWORK_MESSAGE_TIMEOUT_MILLS.PUBLISH_FINALITY.REQUEST;
    }

    /**
     * Builds default publishfinalityAckCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0PublishfinalityAckCommand',
            delay: 0,
            retries: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PublishfinalityAckCommand;
