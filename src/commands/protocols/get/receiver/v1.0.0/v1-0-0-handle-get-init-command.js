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
        const { operationId, blockchain, contract, tokenId, assertionId, state } = commandData;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.GET.ASSERTION_EXISTS_LOCAL_START,
        );

        this.logger.trace(
            `Checking if assertion ${assertionId} exists for state ${state}, on blockchain: ${blockchain}, contract: ${contract}, and tokenId: ${tokenId}`,
        );

        let assertionExists;
        if (
            state !== GET_STATES.FINALIZED &&
            blockchain != null &&
            contract != null &&
            tokenId != null
        ) {
            assertionExists = await this.pendingStorageService.assetHasPendingState(
                PENDING_STORAGE_REPOSITORIES.PUBLIC,
                blockchain,
                contract,
                tokenId,
                assertionId,
            );
        }

        if (!assertionExists) {
            for (const repository of [
                TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY,
            ]) {
                // eslint-disable-next-line no-await-in-loop
                assertionExists = await this.tripleStoreService.assertionExists(
                    repository,
                    assertionId,
                );
                if (assertionExists) {
                    break;
                }
            }
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.GET.ASSERTION_EXISTS_LOCAL_END,
        );

        if (assertionExists) {
            return {
                messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK,
                messageData: {},
            };
        }
        return {
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
