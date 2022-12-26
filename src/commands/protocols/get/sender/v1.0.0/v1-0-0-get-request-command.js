import ProtocolRequestCommand from '../../../common/protocol-request-command.js';
import { ERROR_TYPE, OPERATION_REQUEST_STATUS } from '../../../../../constants/constants.js';

class GetRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.getService;

        this.errorType = ERROR_TYPE.GET.GET_REQUEST_ERROR;
    }

    async prepareMessage(command) {
        return { assertionId: command.data.assertionId };
    }

    async handleAck(command, responseData) {
        if (responseData?.nquads) {
            try {
                await this.operationService.validateAssertion(
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
