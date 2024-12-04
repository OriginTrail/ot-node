import ProtocolRequestCommand from '../../../common/protocol-request-command.js';
import {
    NETWORK_MESSAGE_TIMEOUT_MILLS,
    ERROR_TYPE,
    OPERATION_REQUEST_STATUS,
    OPERATION_STATUS,
} from '../../../../../constants/constants.js';

class FinalityRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.finalityService;
        this.signatureStorageService = ctx.signatureStorageService;
        this.operationIdService = ctx.operationIdService;
        this.errorType = ERROR_TYPE.FINALITY.FINALITY_REQUEST_ERROR;
    }

    async shouldSendMessage(command) {
        const { operationId } = command.data;

        const { status } = await this.operationService.getOperationStatus(operationId);

        if (status === OPERATION_STATUS.IN_PROGRESS) {
            return true;
        }
        this.logger.trace(
            `${command.name} skipped for operationId: ${operationId} with status ${status}`,
        );

        return false;
    }

    async prepareMessage(command) {
        const {
            ual,
            operationId,
            numberOfShardNodes,
            blockchain,
            minimumNumberOfNodeReplications,
        } = command.data;

        return {
            ual,
            operationId,
            numberOfShardNodes,
            blockchain,
            minimumNumberOfNodeReplications,
        };
    }

    messageTimeout() {
        return NETWORK_MESSAGE_TIMEOUT_MILLS.FINALITY.REQUEST;
    }

    async handleAck(command, responseData) {
        if (responseData?.knowledgeCollectionExistsInUnifiedGraph) {
            await this.operationService.processResponse(
                command,
                OPERATION_REQUEST_STATUS.COMPLETED,
                responseData,
            );

            return ProtocolRequestCommand.empty();
        }

        return this.handleNack(command, responseData);
    }

    /**
     * Builds default finalityRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0FinalityRequestCommand',
            delay: 0,
            retries: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default FinalityRequestCommand;
