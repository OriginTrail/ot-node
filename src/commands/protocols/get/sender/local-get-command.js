import Command from '../../../command.js';
import { OPERATION_ID_STATUS, ERROR_TYPE, GET_STATES } from '../../../../constants/constants.js';

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

        let assertion;
        if (
            state === GET_STATES.LATEST &&
            command.data.blockchain != null &&
            command.data.contract != null &&
            command.data.tokenId != null
        ) {
            const cachedAssertion = await this.pendingStorageService.getCachedAssertion(
                command.data.blockchain,
                command.data.contract,
                command.data.tokenId,
                operationId,
            );
            if (cachedAssertion?.assertion?.length) {
                assertion = cachedAssertion.assertion;
            }
        }

        if (typeof assertion === 'undefined' || !assertion.length) {
            assertion = await this.tripleStoreService.localGet(assertionId, true);
        }

        if (assertion.length) {
            await this.operationIdService.cacheOperationIdData(operationId, {
                assertion,
            });
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
