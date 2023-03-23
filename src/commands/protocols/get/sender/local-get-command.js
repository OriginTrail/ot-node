import Command from '../../../command.js';
import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    GET_STATES,
    TRIPLE_STORE_REPOSITORIES,
    PENDING_STORAGE_REPOSITORIES,
} from '../../../../constants/constants.js';

class LocalGetCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
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
        const { operationId, assertionId, state } = command.data;
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.GET.GET_LOCAL_START,
        );

        const response = {};
        if (
            state === GET_STATES.LATEST &&
            command.data.blockchain != null &&
            command.data.contract != null &&
            command.data.tokenId != null
        ) {
            for (const repository of [
                PENDING_STORAGE_REPOSITORIES.PRIVATE,
                PENDING_STORAGE_REPOSITORIES.PUBLIC,
            ]) {
                // eslint-disable-next-line no-await-in-loop
                const cachedAssertion = await this.pendingStorageService.getCachedAssertion(
                    repository,
                    command.data.blockchain,
                    command.data.contract,
                    command.data.tokenId,
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
            ]) {
                // eslint-disable-next-line no-await-in-loop
                response.assertion = await this.tripleStoreService.getAssertion(
                    repository,
                    assertionId,
                );
                if (response?.assertion?.length) break;
            }
        }

        if (!response?.assertion?.length) {
            await this.operationIdService.cacheOperationIdData(operationId, response);
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.GET.GET_LOCAL_END,
            );
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.GET.GET_END,
            );
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.COMPLETED,
            );

            return Command.empty();
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.GET.GET_LOCAL_END,
        );

        return this.continueSequence(command.data, command.sequence);
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
