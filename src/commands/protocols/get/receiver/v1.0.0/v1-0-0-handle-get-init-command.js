import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';
import {
    ERROR_TYPE,
    GET_STATES,
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
    PENDING_STORAGE_REPOSITORIES,
    TRIPLE_STORE_REPOSITORIES,
} from '../../../../../constants/constants.js';

class HandleGetInitCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.tripleStoreService = ctx.tripleStoreService;
        this.operationService = ctx.getService;
        this.pendingStorageService = ctx.pendingStorageService;

        this.errorType = ERROR_TYPE.GET.GET_INIT_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const { assertionId, operationId, state } = commandData;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.GET.ASSERTION_EXISTS_LOCAL_START,
        );

        this.logger.trace(`Checking if assertion ${assertionId} exists for state ${state}.`);

        let assertionExists = false;
        if (
            state === GET_STATES.LATEST &&
            commandData.blockchain != null &&
            commandData.contract != null &&
            commandData.tokenId != null
        ) {
            assertionExists = await this.pendingStorageService.assertionExists(
                PENDING_STORAGE_REPOSITORIES.PUBLIC,
                commandData.blockchain,
                commandData.contract,
                commandData.tokenId,
                operationId,
            );
        } else {
            assertionExists = await this.tripleStoreService.assertionExists(
                TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                assertionId,
            );
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.GET.ASSERTION_EXISTS_LOCAL_END,
        );

        return assertionExists
            ? {
                  messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK,
                  messageData: {},
              }
            : {
                  messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                  messageData: { errorMessage: 'Assertion not found' },
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
