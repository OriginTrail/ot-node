import ProtocolRequestCommand from '../../../common/protocol-request-command.js';
import {
    NETWORK_MESSAGE_TIMEOUT_MILLS,
    ERROR_TYPE,
    OPERATION_ID_STATUS,
    NETWORK_SIGNATURES_FOLDER,
} from '../../../../../constants/constants.js';

class PublishRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.signatureService = ctx.signatureService;
        this.operationIdService = ctx.operationIdService;
        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_STORE_REQUEST_ERROR;

        this.operationStartEvent = OPERATION_ID_STATUS.PUBLISH.PUBLISH_REQUEST_START;
        this.operationEndEvent = OPERATION_ID_STATUS.PUBLISH.PUBLISH_REQUEST_END;
        this.prepareMessageStartEvent =
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_REQUEST_PREPARE_MESSAGE_START;
        this.prepareMessageEndEvent =
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_REQUEST_PREPARE_MESSAGE_END;
        this.sendMessageStartEvent = OPERATION_ID_STATUS.PUBLISH.PUBLISH_SEND_MESSAGE_START;
        this.sendMessageEndEvent = OPERATION_ID_STATUS.PUBLISH.PUBLISH_SEND_MESSAGE_END;
    }

    async prepareMessage(command) {
        const { datasetRoot, operationId, isOperationV0 } = command.data;

        // TODO: Backwards compatibility, send blockchain without chainId
        const { blockchain } = command.data;

        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_GET_CACHED_OPERATION_ID_DATA_START,
            operationId,
            blockchain,
        );
        const { dataset } = await this.operationIdService.getCachedOperationIdData(operationId);
        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_GET_CACHED_OPERATION_ID_DATA_END,
            operationId,
            blockchain,
        );

        return {
            dataset: dataset.public,
            datasetRoot,
            blockchain,
            isOperationV0,
        };
    }

    messageTimeout() {
        return NETWORK_MESSAGE_TIMEOUT_MILLS.PUBLISH.REQUEST;
    }

    async handleAck(command, responseData) {
        const { operationId, blockchain } = command.data;
        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_ADD_SIGNATURE_TO_STORAGE_START,
            operationId,
            blockchain,
        );

        await this.signatureService.addSignatureToStorage(
            NETWORK_SIGNATURES_FOLDER,
            operationId,
            responseData.identityId,
            responseData.signer,
            responseData.v,
            responseData.r,
            responseData.s,
            responseData.vs,
        );
        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_ADD_SIGNATURE_TO_STORAGE_END,
            operationId,
            blockchain,
        );

        return super.handleAck(command, responseData);
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
