import ProtocolRequestCommand from '../../../common/protocol-request-command.js';
import {
    NETWORK_MESSAGE_TIMEOUT_MILLS,
    ERROR_TYPE,
    OPERATION_REQUEST_STATUS,
    OPERATION_STATUS,
    OPERATION_ID_STATUS,
} from '../../../../../constants/constants.js';

class GetRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.getService;
        this.validationService = ctx.validationService;

        this.errorType = ERROR_TYPE.GET.GET_REQUEST_ERROR;
        this.operationStartEvent = OPERATION_ID_STATUS.GET.GET_REQUEST_START;
        this.operationEndEvent = OPERATION_ID_STATUS.GET.GET_REQUEST_END;
        this.sendMessageStartEvent = OPERATION_ID_STATUS.GET.GET_REQUEST_SEND_MESSAGE_START;
        this.sendMessageEndEvent = OPERATION_ID_STATUS.GET.GET_REQUEST_SEND_MESSAGE_END;
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
        const { blockchain, ual, hashFunctionId, paranetUAL, paranetId } = command.data;
        const proximityScoreFunctionsPairId = command.data.proximityScoreFunctionsPairId ?? 2;

        return {
            blockchain,
            ual,
            hashFunctionId,
            proximityScoreFunctionsPairId,
            paranetUAL,
            paranetId,
        };
    }

    async handleAck(command, responseData) {
        if (responseData?.nquads) {
            try {
                await this.validationService.validateAssertion(
                    command.data.assertionId,
                    command.data.blockchain,
                    responseData.nquads,
                );
            } catch (e) {
                return this.handleNack(command, {
                    errorMessage: e.message,
                });
            }

            await this.operationService.processResponse(
                command,
                OPERATION_REQUEST_STATUS.COMPLETED,
                responseData,
            );

            return ProtocolRequestCommand.empty();
        }

        return this.handleNack(command, responseData);
    }

    messageTimeout() {
        return NETWORK_MESSAGE_TIMEOUT_MILLS.GET.REQUEST;
    }

    /**
     * Builds default getRequest
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0GetRequestCommand',
            delay: 0,
            retries: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default GetRequestCommand;
