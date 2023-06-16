import Command from '../../../command.js';
import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    TRIPLE_STORE_REPOSITORIES,
    PENDING_STORAGE_REPOSITORIES,
} from '../../../../constants/constants.js';

class LocalGetCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.config = ctx.config;
        this.operationService = ctx.getService;
        this.operationIdService = ctx.operationIdService;
        this.tripleStoreService = ctx.tripleStoreService;
        this.pendingStorageService = ctx.pendingStorageService;

        this.errorType = ERROR_TYPE.GET.GET_LOCAL_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { operationId, blockchain, contract, tokenId, state } = command.data;
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.GET.GET_LOCAL_START,
        );

        const response = {};
        for (const repository of [
            PENDING_STORAGE_REPOSITORIES.PRIVATE,
            PENDING_STORAGE_REPOSITORIES.PUBLIC,
        ]) {
            // eslint-disable-next-line no-await-in-loop
            const stateIsPending = await this.pendingStorageService.stateIsPending(
                repository,
                blockchain,
                contract,
                tokenId,
                state,
            );

            if (stateIsPending) {
                // eslint-disable-next-line no-await-in-loop
                const cachedAssertion = await this.pendingStorageService.getCachedAssertion(
                    repository,
                    blockchain,
                    contract,
                    tokenId,
                    operationId,
                );

                if (cachedAssertion?.public?.assertion?.length) {
                    response.assertion = cachedAssertion.public.assertion;
                    if (cachedAssertion?.private?.assertion?.length) {
                        response.privateAssertion = cachedAssertion.private.assertion;
                    }
                    break;
                }
            }
        }

        if (!response?.assertion?.length) {
            for (const repository of [
                TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT,
                TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                TRIPLE_STORE_REPOSITORIES.PRIVATE_HISTORY,
                TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY,
            ]) {
                // eslint-disable-next-line no-await-in-loop
                response.assertion = await this.tripleStoreService.getAssertion(repository, state);
                if (response?.assertion?.length) break;
            }
        }

        if (response?.assertion?.length) {
            await this.operationService.markOperationAsCompleted(operationId, response, [
                OPERATION_ID_STATUS.GET.GET_LOCAL_END,
                OPERATION_ID_STATUS.GET.GET_END,
                OPERATION_ID_STATUS.COMPLETED,
            ]);

            return Command.empty();
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.GET.GET_LOCAL_END,
        );

        return this.continueSequence(command.data, command.sequence);
    }

    async handleError(operationId, errorMessage, errorType) {
        await this.operationService.markOperationAsFailed(operationId, errorMessage, errorType);
    }

    /**
     * Builds default localGetCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'localGetCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default LocalGetCommand;
