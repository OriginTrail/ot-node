import { OPERATION_ID_STATUS, ERROR_TYPE } from '../../constants/constants.js';
import Command from '../command.js';

class LocalStoreCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.tripleStoreService = ctx.tripleStoreService;

        this.errorType = ERROR_TYPE.LOCAL_STORE.LOCAL_STORE_ERROR;
    }

    async execute(command) {
        const { operationId } = command.data;

        try {
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_START,
            );

            const assertions = await this.operationIdService.getCachedOperationIdData(operationId);

            await Promise.all(
                assertions.map(({ assertionId, assertion }) =>
                    this.tripleStoreService.localStoreAssertion(
                        assertionId,
                        assertion,
                        operationId,
                    ),
                ),
            );

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_END,
            );

            await this.operationIdService.cacheOperationIdData(operationId, {});

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.COMPLETED,
            );
        } catch (e) {
            await this.handleError(operationId, e.message, this.errorType, true);
        }

        return Command.empty();
    }

    /**
     * Builds default localStoreCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'localStoreCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default LocalStoreCommand;
