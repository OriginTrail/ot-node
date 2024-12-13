import ValidateAssetCommand from '../../../common/validate-asset-command.js';
import Command from '../../../command.js';
import { OPERATION_ID_STATUS, ZERO_BYTES32 } from '../../../../constants/constants.js';

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
        const { operationId, blockchain, contract, tokenId, assertionMerkleRoot } = command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.VALIDATE_ASSET_BLOCKCHAIN_START,
        );

        const blockchainAssertionMerkleRoot =
            await this.blockchainModuleManager.getKnowledgeCollectionMerkleRoot(
                blockchain,
                contract,
                tokenId,
            );
        if (!blockchainAssertionMerkleRoot || blockchainAssertionMerkleRoot === ZERO_BYTES32) {
            return Command.retry();
        }

        const { assertion: cachedData } = await this.operationIdService.getCachedOperationIdData(
            operationId,
        );
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
        this.logger.debug(
            `Validating asset's public assertion with id: ${assertionMerkleRoot} ual: ${ual}`,
        );

        if (blockchainAssertionMerkleRoot !== assertionMerkleRoot) {
            await this.handleError(
                operationId,
                blockchain,
                `Invalid assertion id for asset ${ual}. Received value from blockchain: ${blockchainAssertionMerkleRoot}, received value from request: ${assertionMerkleRoot}`,
                this.errorType,
                true,
            );
            return Command.empty();
        }

        await this.validationService.validateAssertionMerkleRoot(cachedData, assertionMerkleRoot);

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
