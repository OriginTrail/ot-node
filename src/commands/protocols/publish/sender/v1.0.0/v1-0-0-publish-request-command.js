import ProtocolRequestCommand from '../../../common/protocol-request-command.js';
import { NETWORK_MESSAGE_TIMEOUT_MILLS, ERROR_TYPE } from '../../../../../constants/constants.js';

class PublishRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.signatureStorageService = ctx.signatureStorageService;
        this.pendingStorageService = ctx.pendingStorageService;
        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_STORE_REQUEST_ERROR;
    }

    async prepareMessage(command) {
        const { datasetRoot, operationId } = command.data;

        // TODO: Backwards compatibility, send blockchain without chainId
        const { blockchain } = command.data;

        const dataset = await this.pendingStorageService.getCachedDataset(operationId);

        return {
            dataset,
            datasetRoot,
            blockchain,
        };
    }

    messageTimeout() {
        return NETWORK_MESSAGE_TIMEOUT_MILLS.PUBLISH.REQUEST;
    }

    async handleAck(command, responseData) {
        const { operationId } = command.data;
        await this.signatureStorageService.addSignatureToStorage(
            operationId,
            responseData.identityId,
            responseData.signature,
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
