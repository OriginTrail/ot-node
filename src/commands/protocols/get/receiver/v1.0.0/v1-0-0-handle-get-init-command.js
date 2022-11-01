import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';

import {
    ERROR_TYPE,
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
} from '../../../../../constants/constants.js';

class HandleGetInitCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
        this.operationService = ctx.getService;

        this.errorType = ERROR_TYPE.GET.GET_INIT_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const { assertionId, operationId } = commandData;
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.GET.ASSERTION_EXISTS_LOCAL_START,
        );

        const assertionExists = await this.tripleStoreModuleManager.assertionExists(assertionId);

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.GET.ASSERTION_EXISTS_LOCAL_END,
        );

        return {
            messageType: assertionExists
                ? NETWORK_MESSAGE_TYPES.RESPONSES.ACK
                : NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
            messageData: {},
        };
    }

    /**
     * Builds default handleGetInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0HandleGetInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandleGetInitCommand;
