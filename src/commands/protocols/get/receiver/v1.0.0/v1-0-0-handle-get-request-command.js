import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';

import {
    ERROR_TYPE,
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
    GET_STATES,
} from '../../../../../constants/constants.js';

class HandleGetRequestCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.getService;
        this.tripleStoreService = ctx.tripleStoreService;
        this.pendingStorageService = ctx.pendingStorageService;

        this.errorType = ERROR_TYPE.GET.GET_REQUEST_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const { assertionId, operationId, state } = commandData;
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.GET.GET_REMOTE_START,
        );

        if (
            state === GET_STATES.LATEST &&
            commandData.blockchain != null &&
            commandData.contract != null &&
            commandData.tokenId != null
        ) {
            const cachedAssertion = await this.pendingStorageService.getCachedAssertion(
                commandData.blockchain,
                commandData.contract,
                commandData.tokenId,
                operationId,
            );
            if (cachedAssertion?.assertion?.length) {
                return {
                    messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK,
                    messageData: { nquads: cachedAssertion.assertion },
                };
            }
        }

        const nquads = await this.tripleStoreService.localGet(assertionId);

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.GET.GET_REMOTE_END,
        );

        return nquads.length
            ? { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: { nquads } }
            : {
                  messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                  messageData: { errorMessage: `Invalid number of nquads: ${nquads.length}` },
              };
    }

    /**
     * Builds default handleGetRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0HandleGetRequestCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.HANDLE_GET_REQUEST_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandleGetRequestCommand;
