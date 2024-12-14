import Command from '../../../command.js';
import { ERROR_TYPE } from '../../../../constants/constants.js';

class GetAssertionMerkleRootCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.getService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;

        this.errorType = ERROR_TYPE.GET.GET_ASSERTION_ID_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { operationId, blockchain, contract, knowledgeCollectionId } = command.data;
        this.logger.info(
            `Getting assertion id for token id: ${knowledgeCollectionId}, contract: ${contract}, operation id: ${operationId} on blockchain: ${blockchain}`,
        );

        const assertionId = await this.blockchainModuleManager.getLatestAssertionId(
            blockchain,
            contract,
            knowledgeCollectionId,
        );

        this.logger.info(
            `Found assertion id: ${assertionId} for token id: ${knowledgeCollectionId}, contract: ${contract} on blockchain: ${blockchain} for operation id: ${operationId}`,
        );
        return this.continueSequence({ ...command.data, assertionId }, command.sequence);
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
     * Builds default getAssertionMerkleRootCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'getAssertionMerkleRootCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default GetAssertionMerkleRootCommand;
