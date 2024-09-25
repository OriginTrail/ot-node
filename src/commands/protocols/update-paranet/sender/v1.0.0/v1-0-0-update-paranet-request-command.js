import ProtocolRequestCommand from '../../../common/protocol-request-command.js';
import { NETWORK_MESSAGE_TIMEOUT_MILLS, ERROR_TYPE } from '../../../../../constants/constants.js';

class UpdateParanetRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.updateParanetService;

        this.errorType = ERROR_TYPE.UPDATE_PARANET.UPDATE_PARANET_REQUEST_ERROR;
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
        return NETWORK_MESSAGE_TIMEOUT_MILLS.UPDATE_PARANET.REQUEST;
    }

    /**
     * Builds default v1_0_0UpdateParanetRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0UpdateParanetRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default UpdateParanetRequestCommand;
