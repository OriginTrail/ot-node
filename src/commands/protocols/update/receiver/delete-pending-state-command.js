import Command from '../../../command.js';
import {
    ERROR_TYPE,
    PENDING_STORAGE_REPOSITORIES,
    TRIPLE_STORE_REPOSITORIES,
} from '../../../../constants/constants.js';

class DeletePendingStateCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.pendingStorageService = ctx.pendingStorageService;

        this.errorType = ERROR_TYPE.UPDATE.UPDATE_DELETE_PENDING_STATE_ERROR;
    }

    async execute(command) {
        const { blockchain, contract, tokenId, assertionId, operationId, keyword, hashFunctionId } =
            command.data;

        this.logger.trace(
            `Started ${command.name} for blockchain: ${blockchain} contract: ${contract}, ` +
                `token id: ${tokenId}, assertion id: ${assertionId}, operation id: ${operationId}` +
                `keyword: ${keyword}, hash function id: ${hashFunctionId}`,
        );

        const pendingStateExists = await this.pendingStateExists(
            blockchain,
            contract,
            tokenId,
            assertionId,
        );

        if (pendingStateExists) {
            this.logger.trace(
                `Pending state exists for token id: ${tokenId}, assertion id: ${assertionId}, blockchain: ${blockchain} and operationId: ${operationId}`,
            );
            const assetStates = await this.blockchainModuleManager.getAssertionIds(
                blockchain,
                contract,
                tokenId,
            );
            if (assetStates.includes(assertionId)) {
                const stateIndex = assetStates.indexOf(assertionId);
                this.logger.trace(
                    `Node missed state finalized event for token id: ${tokenId}, assertion id: ${assertionId}, blockchain: ${blockchain} and operationId: ${operationId}. Node will now move data from pending storage to triple store`,
                );
                await Promise.all([
                    this.pendingStorageService.moveAndDeletePendingState(
                        TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                        TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY,
                        PENDING_STORAGE_REPOSITORIES.PUBLIC,
                        blockchain,
                        contract,
                        tokenId,
                        keyword,
                        hashFunctionId,
                        assertionId,
                        stateIndex,
                    ),
                    this.pendingStorageService.moveAndDeletePendingState(
                        TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT,
                        TRIPLE_STORE_REPOSITORIES.PRIVATE_HISTORY,
                        PENDING_STORAGE_REPOSITORIES.PRIVATE,
                        blockchain,
                        contract,
                        tokenId,
                        keyword,
                        hashFunctionId,
                        assertionId,
                        stateIndex,
                    ),
                ]);
            }
            await this.deletePendingState(blockchain, contract, tokenId, assertionId, operationId);
        }
        this.logger.trace(`No pending state found`);
        return Command.empty();
    }

    async deletePendingState(blockchain, contract, tokenId, assertionId, operationId) {
        for (const repository of [
            PENDING_STORAGE_REPOSITORIES.PUBLIC,
            PENDING_STORAGE_REPOSITORIES.PRIVATE,
        ]) {
            // eslint-disable-next-line no-await-in-loop
            await this.pendingStorageService.removeCachedAssertion(
                repository,
                blockchain,
                contract,
                tokenId,
                assertionId,
                operationId,
            );
        }
    }

    async pendingStateExists(blockchain, contract, tokenId, assertionId) {
        for (const repository of [
            PENDING_STORAGE_REPOSITORIES.PUBLIC,
            PENDING_STORAGE_REPOSITORIES.PRIVATE,
        ]) {
            // eslint-disable-next-line no-await-in-loop
            const pendingStateExists = await this.pendingStorageService.assetHasPendingState(
                repository,
                blockchain,
                contract,
                tokenId,
                assertionId,
            );

            if (pendingStateExists) {
                return true;
            }
        }
        this.logger.debug(`No pending state exists for assertion id: ${assertionId}`);
        return false;
    }

    /**
     * Builds default deletePendingStorageCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'deletePendingStateCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default DeletePendingStateCommand;
