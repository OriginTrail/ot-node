import ValidateAssetCommand from '../../../common/validate-asset-command.js';
import Command from '../../../command.js';
import {
    OPERATION_ID_STATUS,
    LOCAL_STORE_TYPES,
    ZERO_BYTES32,
} from '../../../../constants/constants.js';

class PublishValidateAssetBlockchainCommand extends ValidateAssetCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
    }

    async handleError(operationId, blockchain, errorMessage, errorType) {
        await this.operationService.markOperationAsFailed(
            operationId,
            blockchain,
            errorMessage,
            errorType,
        );
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            operationId,
            blockchain,
            contract,
            tokenId,
            storeType = LOCAL_STORE_TYPES.TRIPLE,
        } = command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.VALIDATE_ASSET_BLOCKCHAIN_START,
        );

        let blockchainAssertionId;
        if (
            storeType === LOCAL_STORE_TYPES.TRIPLE ||
            storeType === LOCAL_STORE_TYPES.TRIPLE_PARANET
        ) {
            blockchainAssertionId = await this.blockchainModuleManager.getLatestAssertionId(
                blockchain,
                contract,
                tokenId,
            );
        } else {
            blockchainAssertionId = await this.blockchainModuleManager.getUnfinalizedAssertionId(
                blockchain,
                tokenId,
            );
        }
        if (!blockchainAssertionId || blockchainAssertionId === ZERO_BYTES32) {
            return Command.retry();
        }

        const cachedData = await this.operationIdService.getCachedOperationIdData(operationId);
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
        this.logger.info(
            `Validating asset's public assertion with id: ${cachedData.public.assertionId} ual: ${ual}`,
        );

        if (blockchainAssertionId !== cachedData.public.assertionId) {
            await this.handleError(
                operationId,
                blockchain,
                `Invalid assertion id for asset ${ual}. Received value from blockchain: ${blockchainAssertionId}, received value from request: ${cachedData.public.assertionId}`,
                this.errorType,
                true,
            );
            return Command.empty();
        }

        await this.validationService.validateAssertion(
            cachedData.public.assertionId,
            blockchain,
            cachedData.public.assertion,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.VALIDATE_ASSET_BLOCKCHAIN_END,
        );
        return this.continueSequence(
            { ...command.data, retry: undefined, period: undefined },
            command.sequence,
        );
    }

    /**
     * Builds default PublishValidateAssetBlockchainCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'publishValidateAssetBlockchainCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PublishValidateAssetBlockchainCommand;
