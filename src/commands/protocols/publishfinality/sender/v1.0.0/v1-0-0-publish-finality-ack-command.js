import Command from '../../../../command.js';
import ProtocolRequestCommand from '../../../common/protocol-request-command.js';
import {
    NETWORK_MESSAGE_TIMEOUT_MILLS,
    ERROR_TYPE,
    OPERATION_ID_STATUS,
} from '../../../../../constants/constants.js';

class PublishfinalityAckCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishFinalityService;
        this.operationIdService = ctx.operationIdService;
        this.errorType = ERROR_TYPE.PUBLISH_FINALITY.PUBLISH_FINALITY_REQUEST_ERROR;
    }

    async prepareMessage(command) {
        const { ual, publishOperationId, blockchain, operationId } = command.data;

        return { ual, publishOperationId, blockchain, operationId };
    }

    async handleAck(command) {
        await this.operationIdService.updateOperationIdStatus(
            command.operationId,
            command.blockchain,
            OPERATION_ID_STATUS.COMPLETED,
        );
        return this.continueSequence(command.data, command.sequence);
    }

    async handleNack(command, responseData) {
        await this.operationIdService.updateOperationIdStatus(
            command.operationId,
            command.blockchain,
            OPERATION_ID_STATUS.COMPLETED,
        );
        await this.markResponseAsFailed(
            command,
            `Received NACK response from node during ${command.name}. Error message: ${responseData.errorMessage}`,
        );
        return Command.empty();
    }

    messageTimeout() {
        return NETWORK_MESSAGE_TIMEOUT_MILLS.PUBLISH_FINALITY.REQUEST;
    }

    /**
     * Builds default publishfinalityAckCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0PublishfinalityAckCommand',
            delay: 0,
            retries: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PublishfinalityAckCommand;
