import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';
import {
    ERROR_TYPE,
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
} from '../../../../../constants/constants.js';

class HandlePublishfinalityAckCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishFinalityService;
        this.tripleStoreService = ctx.tripleStoreService;
        this.pendingStorageService = ctx.pendingStorageService;
        this.paranetService = ctx.paranetService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.errorType = ERROR_TYPE.PUBLISH_FINALITY.PUBLISH_FINALITY_REQUEST_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const { ual, publishOperationId, blockchain, operationId, remotePeerId } = commandData;
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH_FINALITY.PUBLISH_FINALITY_REMOTE_START,
        );

        let response;
        let success;
        try {
            await this.repositoryModuleManager.savePublishFinalityAck(
                publishOperationId,
                ual,
                remotePeerId,
            );

            success = true;
            response = {
                messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK,
                messageData: { message: `Acknowledged storing of ${ual}.` },
            };
        } catch (err) {
            success = false;
            response = {
                messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                messageData: { errorMessage: `Failed to acknowledge storing of ${ual}.` },
            };
        }

        await this.operationService.markOperationAsCompleted(operationId, blockchain, success, [
            OPERATION_ID_STATUS.PUBLISH_FINALITY.PUBLISH_FINALITY_FETCH_FROM_NODES_END,
            OPERATION_ID_STATUS.PUBLISH_FINALITY.PUBLISH_FINALITY_END,
            OPERATION_ID_STATUS.COMPLETED,
        ]);
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH_FINALITY.PUBLISH_FINALITY_REMOTE_END,
        );

        return response;
    }

    /**
     * Builds default handlePublishfinalityAckCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0HandlePublishfinalityAckCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.PUBLISH_FINALITY.PUBLISH_FINALITY_REQUEST_REMOTE_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandlePublishfinalityAckCommand;
