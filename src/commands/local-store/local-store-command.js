import { OPERATION_ID_STATUS, ERROR_TYPE, LOCAL_STORE_TYPES } from "../../constants/constants.js";
import Command from '../command.js';

class LocalStoreCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.tripleStoreService = ctx.tripleStoreService;
        this.pendingStorageService = ctx.pendingStorageService;
        this.operationIdService = ctx.operationIdService;

        this.errorType = ERROR_TYPE.LOCAL_STORE.LOCAL_STORE_ERROR;
    }

    async execute(command) {
        const { operationId, storeType } = command.data;

        let assertions = [];
        try {
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_START,
            );

            assertions = await this.operationIdService.getCachedOperationIdData(operationId);

            await Promise.all(
              assertions.map(({ assertionId, assertion, blockchain, contract, tokenId }) => {
                  if(storeType === LOCAL_STORE_TYPES.TRIPLE) {
                      this.tripleStoreService.localStoreAssertion(
                        assertionId,
                        assertion,
                        operationId,
                      );
                  } else {
                      this.pendingStorageService.cacheAssertion(
                        blockchain,
                        contract,
                        tokenId,
                        { assertion },
                        operationId
                      );
                  }
              }),
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
            return Command.empty();
        }

        if (command?.sequence?.length) {
            await this.operationIdService.cacheOperationIdData(operationId, {
                assertion: assertions[0].assertion,
            });
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
