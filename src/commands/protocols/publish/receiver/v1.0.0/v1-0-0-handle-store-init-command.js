import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';
import { ERROR_TYPE, OPERATION_ID_STATUS } from '../../../../../constants/constants.js';

class HandleStoreInitCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.publishService = ctx.publishService;
        this.ualService = ctx.ualService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_REMOTE_ERROR;
    }

    async prepareMessage(command) {
        const { operationId, assertionId, blockchain, contract, tokenId, keyword, hashFunctionId } =
            command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
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
            OPERATION_ID_STATUS.VALIDATE_ASSET_REMOTE_END,
        );

        return validationResult;
    }

    async retryFinished(command) {
        this.handleError(command, `Max retries exceeded! Unable to validate the data.`);
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
