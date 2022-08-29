/* eslint-disable import/extensions */
import HandleProtocolMessageCommand from '../../common/handle-protocol-message-command.js';

import {
    NETWORK_MESSAGE_TYPES,
    ERROR_TYPE,
    OPERATION_ID_STATUS,
} from '../../../../constants/constants.js';

class HandleStoreInitCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const { operationId, ual } = commandData;

        this.logger.info(`Validating assertion with ual: ${ual}`);

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_REMOTE_START,
        );

        const assertionId = await this.operationService.getAssertion(ual, operationId);

        await Promise.all([
            this.operationIdService.cacheOperationIdData(operationId, { assertionId }),
            this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_REMOTE_END,
            ),
        ]);

        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: {} };
    }

    async retryFinished(command) {
        const { operationId } = command.data;
        this.handleError(
            `Retry count for command: ${command.name} reached! Unable to validate data for operation id: ${operationId}`,
            command,
        );
    }

    /**
     * Builds default handleStoreInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'handleStoreInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandleStoreInitCommand;
