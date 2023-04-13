import Command from '../command.js';
import { ERROR_TYPE, OPERATION_ID_STATUS, LOCAL_STORE_TYPES } from '../../constants/constants.js';

class ValidateAssetCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.ualService = ctx.ualService;
        this.dataService = ctx.dataService;
        this.validationService = ctx.validationService;

        this.errorType = ERROR_TYPE.VALIDATE_ASSET_ERROR;
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
        if (!blockchainAssertionId) {
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

        if (cachedData.private?.assertionId && cachedData.private?.assertion) {
            this.logger.info(
                `Validating asset's private assertion with id: ${cachedData.private.assertionId} ual: ${ual}`,
            );

            try {
                this.validationService.validateAssertionId(
                    cachedData.private.assertion,
                    cachedData.private.assertionId,
                );
            } catch (error) {
                await this.handleError(operationId, error.message, this.errorType, true);
                return Command.empty();
            }
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.VALIDATE_ASSET_END,
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
