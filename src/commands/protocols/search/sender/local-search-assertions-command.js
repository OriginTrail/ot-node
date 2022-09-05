import Command from '../../../command.js';
import { OPERATION_ID_STATUS } from '../../../../constants/constants.js';

class LocalSearchAssertionsCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.networkModuleManager = ctx.networkModuleManager;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
        this.operationIdService = ctx.operationIdService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { operationId, query, options } = command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.SEARCH_ASSERTIONS.SEARCHING_ASSERTIONS,
        );

        try {
            const localQuery = true;
            const response = await this.tripleStoreModuleManager.findAssertionsByKeyword(
                query,
                options,
                localQuery,
            );

            const data = {};
            data.assertions = response.map((assertion) => assertion.assertionId);

            await this.operationIdService.cacheOperationIdData(operationId, data);
        } catch (e) {
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.FAILED,
                e.message,
            );
        }

        return this.continueSequence(command.data, command.sequence);
    }

    handleError(operationId, error, msg) {
        this.logger.error(msg);
    }

    /**
     * Builds default localSearchAssertionsCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'localSearchAssertionsCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default LocalSearchAssertionsCommand;
