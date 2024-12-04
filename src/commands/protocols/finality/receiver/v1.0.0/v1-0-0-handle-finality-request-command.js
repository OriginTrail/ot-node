import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';
import {
    ERROR_TYPE,
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
} from '../../../../../constants/constants.js';

class HandleFinalityRequestCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.finalityService;
        this.tripleStoreService = ctx.tripleStoreService;
        this.pendingStorageService = ctx.pendingStorageService;
        this.paranetService = ctx.paranetService;

        this.errorType = ERROR_TYPE.FINALITY.FINALITY_REQUEST_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const { ual, operationId, blockchain } = commandData;
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.FINALITY.FINALITY_REMOTE_START,
        );

        const knowledgeCollectionExistsInUnifiedGraph =
            await this.tripleStoreService.checkIfKnowledgeCollectionExistsInUnifiedGraph(ual);
        if (knowledgeCollectionExistsInUnifiedGraph) {
            await this.operationService.markOperationAsCompleted(
                operationId,
                blockchain,
                knowledgeCollectionExistsInUnifiedGraph,
                [
                    OPERATION_ID_STATUS.FINALITY.FINALITY_FETCH_FROM_NODES_END,
                    OPERATION_ID_STATUS.FINALITY.FINALITY_END,
                    OPERATION_ID_STATUS.COMPLETED,
                ],
            );
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.FINALITY.FINALITY_REMOTE_END,
        );

        return knowledgeCollectionExistsInUnifiedGraph
            ? {
                  messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK,
                  messageData: { knowledgeCollectionExistsInUnifiedGraph },
              }
            : {
                  messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                  messageData: { errorMessage: `Unable to find knowledge collection ${ual}` },
              };
    }

    /**
     * Builds default handleFinalityRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0HandleFinalityRequestCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.FINALITY.FINALITY_REQUEST_REMOTE_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandleFinalityRequestCommand;
