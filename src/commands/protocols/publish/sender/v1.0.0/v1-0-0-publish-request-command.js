import ProtocolRequestCommand from '../../../common/protocol-request-command.js';
import { NETWORK_MESSAGE_TIMEOUT_MILLS, ERROR_TYPE } from '../../../../../constants/constants.js';

class PublishRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_STORE_REQUEST_ERROR;
    }

    async prepareMessage(command) {
        const { publicAssertion } = await this.operationIdService.getCachedOperationIdData(
            command.data.operationId,
        );

        return {
            assertion: publicAssertion,
        };
    }

    messageTimeout() {
        return NETWORK_MESSAGE_TIMEOUT_MILLS.PUBLISH.REQUEST;
    }

    /**
     * Builds default publishRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0PublishRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PublishRequestCommand;
