import Command from '../../../command.js';
import { ERROR_TYPE, PENDING_STORAGE_REPOSITORIES } from '../../../../constants/constants.js';

class DeletePendingStateCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.pendingStorageService = ctx.pendingStorageService;

        this.errorType = ERROR_TYPE.UPDATE.UPDATE_DELETE_PENDING_STATE_ERROR;
    }

    async execute(command) {
        const { blockchain, contract, tokenId, assertionId, operationId } = command.data;

        this.logger.trace(
            `Started the command for the Blockchain: ${blockchain}, Contract: ${contract}, ` +
                `Token ID: ${tokenId}, Assertion ID: ${assertionId}.`,
            command,
        );

        const assetStates = await this.blockchainModuleManager.getAssertionIds(
            blockchain,
            contract,
            tokenId,
        );

        if (assetStates.includes(assertionId)) {
            this.logger.trace(
                `Not clearing the pending storage as state was finalized and clearing is triggered by StateFinalized event.`,
                command,
            );
            return Command.empty();
        }

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

            if (!pendingStateExists) {
                continue;
            }

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

        return Command.empty();
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
