import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';
import { ERROR_TYPE, OPERATION_ID_STATUS } from '../../../../../constants/constants.js';

class HandleStoreInitCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.publishService = ctx.publishService;
        this.ualService = ctx.ualService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const { operationId, assertionId, blockchain, contract, tokenId, keyword, hashFunctionId } =
            commandData;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.VALIDATE_ASSET_REMOTE_START,
        );

        const validationResult = await this.validateReceivedData(
            operationId,
            assertionId,
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
        );

        this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.VALIDATE_ASSET_REMOTE_END,
        );

        return validationResult;
    }

    async retryFinished(command) {
        const { operationId } = command.data;
        await this.handleError(
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
            name: 'v1_0_0HandleStoreInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandleStoreInitCommand;
