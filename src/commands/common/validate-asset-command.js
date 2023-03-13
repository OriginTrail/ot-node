import Command from '../command.js';
import { ERROR_TYPE, OPERATION_ID_STATUS, LOCAL_STORE_TYPES } from '../../constants/constants.js';

class ValidateAssetCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.operationService = ctx.publishService;
        this.ualService = ctx.ualService;
        this.dataService = ctx.dataService;
        this.validationModuleManager = ctx.validationModuleManager;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_VALIDATE_ASSERTION_ERROR;
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
            OPERATION_ID_STATUS.PUBLISH.VALIDATING_PUBLISH_ASSERTION_START,
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
        if (!blockchainAssertionId) {
            return Command.retry();
        }
        const cachedData = await this.operationIdService.getCachedOperationIdData(operationId);
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
        this.logger.info(
            `Validating asset's public assertion with id: ${cachedData.publicAssertionId} ual: ${ual}`,
        );
        if (blockchainAssertionId !== cachedData.publicAssertionId) {
            await this.handleError(
                operationId,
                `Invalid assertion id for asset ${ual}. Received value from blockchain: ${blockchainAssertionId}, received value from request: ${cachedData.publicAssertionId}`,
                this.errorType,
                true,
            );
            return Command.empty();
        }

        await this.operationService.validateAssertion(
            cachedData.publicAssertionId,
            blockchain,
            cachedData.publicAssertion,
        );

        if (cachedData.privateAssertionId && cachedData.privateAssertion) {
            this.logger.info(
                `Validating asset's private assertion with id: ${cachedData.privateAssertionId} ual: ${ual}`,
            );

            const calculatedAssertionId = this.validationModuleManager.calculateRoot(
                cachedData.privateAssertion,
            );

            if (cachedData.privateAssertionId !== calculatedAssertionId) {
                await this.handleError(
                    operationId,
                    `Invalid private assertion id. Received value from request: ${cachedData.privateAssertionId}, calculated: ${calculatedAssertionId}`,
                    this.errorType,
                    true,
                );
            }
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.VALIDATING_PUBLISH_ASSERTION_END,
        );
        return this.continueSequence(
            { ...command.data, retry: undefined, period: undefined },
            command.sequence,
        );
    }

    async retryFinished(command) {
        const { blockchain, contract, tokenId, operationId } = command.data;
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
        await this.handleError(
            operationId,
            `Max retry count for command: ${command.name} reached! Unable to validate ual: ${ual}`,
            this.errorType,
            true,
        );
    }

    /**
     * Builds default validateAssetCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'validateAssetCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default ValidateAssetCommand;
