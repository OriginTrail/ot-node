import Command from '../../../command.js';
import { ERROR_TYPE, TRIPLE_STORE_REPOSITORIES } from '../../../../constants/constants.js';

class GetAssertionMerkleRootCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.getService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.tripleStoreService = ctx.tripleStoreService;

        this.errorType = ERROR_TYPE.GET.GET_ASSERTION_ID_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { operationId, ual } = command.data;
        this.logger.info(`Getting assertion id and operation id ${operationId} for ual: ${ual}`);

        let assertionId = await this.tripleStoreService.getLatestAssertionId(
            TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
            ual,
        );

        if (!assertionId) {
            assertionId = await this.tripleStoreService.getLatestAssertionId(
                TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT,
                ual,
            );
        }

        if (!assertionId) {
            throw new Error(`No assertionId found for UAL: ${ual} in either repository.`);
        }
        this.logger.info(
            `Found assertion id: ${assertionId} and operation id ${operationId} ual: ${ual}`,
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
