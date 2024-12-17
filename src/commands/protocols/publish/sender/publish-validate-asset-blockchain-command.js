import ValidateAssetCommand from '../../../common/validate-asset-command.js';
import { OPERATION_ID_STATUS } from '../../../../constants/constants.js';

class PublishValidateAssetBlockchainCommand extends ValidateAssetCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.validationService = ctx.validationService;
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
        const { operationId, blockchain, contract, tokenId, datasetRoot } = command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.VALIDATE_ASSET_BLOCKCHAIN_START,
        );
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
        this.logger.debug(
            `Validating asset's public assertion with id: ${datasetRoot} ual: ${ual}`,
        );

        await this.validationService.validateDatasetRootOnBlockchain(
            datasetRoot,
            blockchain,
            contract,
            tokenId,
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
