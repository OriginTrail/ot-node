import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';
import {
    ERROR_TYPE,
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
} from '../../../../../constants/constants.js';

class HandleAskRequestCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.askService;
        this.tripleStoreService = ctx.tripleStoreService;
        this.pendingStorageService = ctx.pendingStorageService;
        this.paranetService = ctx.paranetService;

        this.errorType = ERROR_TYPE.ASK.ASK_REQUEST_REMOTE_ERROR;
        this.operationStartEvent = OPERATION_ID_STATUS.ASK.ASK_REMOTE_START;
        this.operationEndEvent = OPERATION_ID_STATUS.ASK.ASK_REMOTE_END;
        this.prepareMessageStartEvent = OPERATION_ID_STATUS.ASK.ASK_REMOTE_PREPARE_MESSAGE_START;
        this.prepareMessageEndEvent = OPERATION_ID_STATUS.ASK.ASK_REMOTE_PREPARE_MESSAGE_END;
        this.sendMessageResponseStartEvent = OPERATION_ID_STATUS.ASK.ASK_REMOTE_SEND_MESSAGE_START;
        this.sendMessageResponseEndEvent = OPERATION_ID_STATUS.ASK.ASK_REMOTE_SEND_MESSAGE_END;
        this.removeCachedSessionStartEvent =
            OPERATION_ID_STATUS.ASK.ASK_REMOTE_REMOVE_CACHED_SESSION_START;
        this.removeCachedSessionEndEvent =
            OPERATION_ID_STATUS.ASK.ASK_REMOTE_REMOVE_CACHED_SESSION_END;
    }

    async prepareMessage(commandData) {
        const { ual, operationId, blockchain } = commandData;
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.ASK.ASK_REMOTE_START,
        );

        const knowledgeCollectionsExistArray =
            await this.tripleStoreService.checkIfKnowledgeCollectionsExistInUnifiedGraph(ual);
        const success = !!knowledgeCollectionsExistArray?.length;
        if (success) {
            await this.operationService.markOperationAsCompleted(
                operationId,
                blockchain,
                knowledgeCollectionsExistArray,
                [
                    OPERATION_ID_STATUS.ASK.ASK_FETCH_FROM_NODES_END,
                    OPERATION_ID_STATUS.ASK.ASK_END,
                    OPERATION_ID_STATUS.COMPLETED,
                ],
            );
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.ASK.ASK_REMOTE_END,
        );

        return success
            ? {
                  messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK,
                  messageData: { knowledgeCollectionsExistArray },
              }
            : {
                  messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                  messageData: {
                      errorMessage: `Unable to find knowledge collections ${ual.join(', ')}`,
                  },
              };
    }

    /**
     * Builds default handleAskRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0HandleAskRequestCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.ASK.ASK_REQUEST_REMOTE_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandleAskRequestCommand;
