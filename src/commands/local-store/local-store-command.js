import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    LOCAL_STORE_TYPES,
    PENDING_STORAGE_REPOSITORIES,
} from '../../constants/constants.js';
import Command from '../command.js';

class LocalStoreCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.tripleStoreService = ctx.tripleStoreService;
        this.pendingStorageService = ctx.pendingStorageService;
        this.operationIdService = ctx.operationIdService;
        this.dataService = ctx.dataService;

        this.errorType = ERROR_TYPE.LOCAL_STORE.LOCAL_STORE_ERROR;
    }

    async execute(command) {
        const {
            operationId,
            blockchain,
            contract,
            tokenId,
            storeType = LOCAL_STORE_TYPES.TRIPLE,
        } = command.data;

        try {
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_START,
            );

            const cachedData = await this.operationIdService.getCachedOperationIdData(operationId);

            if (storeType === LOCAL_STORE_TYPES.TRIPLE) {
                const storePromises = [];
                if (cachedData.publicAssertion && cachedData.publicAssertionId) {
                    storePromises.push(
                        this.tripleStoreService.localStoreAssertion(
                            cachedData.publicAssertionId,
                            cachedData.publicAssertion,
                            operationId,
                        ),
                    );
                }
                if (cachedData.privateAssertion && cachedData.privateAssertionId) {
                    storePromises.push(
                        this.tripleStoreService.localStoreAssertion(
                            cachedData.privateAssertionId,
                            cachedData.privateAssertion,
                            operationId,
                        ),
                    );
                }
                await Promise.all(storePromises);
            } else {
                await this.pendingStorageService.cacheAssertion(
                    PENDING_STORAGE_REPOSITORIES.PRIVATE,
                    blockchain,
                    contract,
                    tokenId,
                    {
                        publicAssertion: cachedData.publicAssertion,
                        publicAssertionId: cachedData.publicAssertionId,
                        privateAssertion: cachedData.privateAssertion,
                        privateAssertionId: cachedData.privateAssertionId,
                    },
                    operationId,
                );
            }

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
            return Command.empty();
        }

        return this.continueSequence(command.data, command.sequence);
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
