import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';
import { ERROR_TYPE, OPERATION_ID_STATUS } from '../../../../../constants/constants.js';

class HandleUpdateInitCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.ualService = ctx.ualService;
        this.shardingTableService = ctx.shardingTableService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.errorType = ERROR_TYPE.UPDATE.UPDATE_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const { operationId, assertionId, blockchain, contract, tokenId, keyword, hashFunctionId } =
            commandData;
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.VALIDATE_ASSET_REMOTE_START,
        );

        await this.operationIdService.cacheOperationIdData(operationId, {
            assertionId,
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
        });

        const validationResult = await this.validateReceivedData(
            operationId,
            assertionId,
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.VALIDATE_ASSET_REMOTE_END,
        );
        return validationResult;
    }

    async validateAssertionId(blockchain, contract, tokenId, assertionId, ual) {
        const blockchainAssertionId = await this.blockchainModuleManager.getUnfinalizedAssertionId(
            blockchain,
            tokenId,
        );
        if (blockchainAssertionId !== assertionId) {
            throw Error(
                `Invalid assertion id for asset ${ual}. Received value from blockchain: ${blockchainAssertionId}, received value from request: ${assertionId}`,
            );
        }
    }

    async retryFinished(command) {
        const { operationId } = command.data;
        this.handleError(
            `Retry count for command: ${command.name} reached! Unable to validate data for operation id: ${operationId}`,
            command,
        );
    }

    /**
     * Builds default v1_0_0HandleUpdateInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0HandleUpdateInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandleUpdateInitCommand;
