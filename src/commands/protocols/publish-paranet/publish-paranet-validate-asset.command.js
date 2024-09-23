import Command from '../../command.js';
import ValidateAssetCommand from '../../common/validate-asset-command.js';
import {
    // ERROR_TYPE,
    OPERATION_ID_STATUS,
    LOCAL_STORE_TYPES,
    ZERO_BYTES32,
} from '../../../constants/constants.js';

class PublishParanetValidateAssetCommand extends ValidateAssetCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        // TODO: Validate this node is in paranet, validate this asset is in paranet
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
            OPERATION_ID_STATUS.VALIDATE_ASSET_START,
        );

        let blockchainAssertionId;
        if (storeType === LOCAL_STORE_TYPES.TRIPLE) {
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
            `Validating asset's public assertion with id: ${cachedData.cachedAssertions.public.assertionId} ual: ${ual}`,
        );
        if (blockchainAssertionId !== cachedData.cachedAssertions.public.assertionId) {
            await this.handleError(
                operationId,
                blockchain,
                `Invalid assertion id for asset ${ual}. Received value from blockchain: ${blockchainAssertionId}, received value from request: ${cachedData.cachedAssertions.assertionId}`,
                this.errorType,
                true,
            );
            return Command.empty();
        }

        await this.validationService.validateAssertion(
            cachedData.cachedAssertions.public.assertionId,
            blockchain,
            cachedData.cachedAssertions.public.assertion,
        );

        if (
            cachedData.cachedAssertions.private?.assertionId &&
            cachedData.cachedAssertions.private?.assertion
        ) {
            this.logger.info(
                `Validating asset's private assertion with id: ${cachedData.cachedAssertions.private.assertionId} ual: ${ual}`,
            );

            try {
                this.validationService.validateAssertionId(
                    cachedData.cachedAssertions.private.assertion,
                    cachedData.cachedAssertions.private.assertionId,
                );
            } catch (error) {
                await this.handleError(
                    operationId,
                    blockchain,
                    error.message,
                    this.errorType,
                    true,
                );
                return Command.empty();
            }
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.VALIDATE_ASSET_END,
        );
        return this.continueSequence(
            { ...command.data, retry: undefined, period: undefined },
            command.sequence,
        );
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
     * Builds default PublishParanetValidateAssetCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'publishParanetValidateAssetCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PublishParanetValidateAssetCommand;
