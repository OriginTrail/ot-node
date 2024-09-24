import ProtocolRequestCommand from '../../../common/protocol-request-command.js';
import { NETWORK_MESSAGE_TIMEOUT_MILLS, ERROR_TYPE } from '../../../../../constants/constants.js';

class PublishParanetRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishParanetService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_STORE_REQUEST_ERROR;
    }

    async prepareMessage(command) {
        const cachedData = await this.operationIdService.getCachedOperationIdData(
            command.data.operationId,
        );

        return {
            assertions: cachedData.cachedAssertions,
            paranetUAL: cachedData.paranetUAL,
            sender: cachedData.sender,
            txHash: cachedData.txHash,
        };
    }

    messageTimeout() {
        return NETWORK_MESSAGE_TIMEOUT_MILLS.PUBLISH.REQUEST;
    }

    /**
     * Builds default PublishParanetRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0PublishParanetRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PublishParanetRequestCommand;
