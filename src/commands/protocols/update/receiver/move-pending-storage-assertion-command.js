import Command from '../../../command.js';
import { ERROR_TYPE } from '../../../../constants/constants.js';

class MovePendingStorageAssertionCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.pendingStorageService = ctx.pendingStorageService;

        this.errorType = ERROR_TYPE.MOVE_PENDING_STORAGE_ASSERTION_COMMAND;
    }

    async execute(command) {
        const { blockchain, contract, tokenId, operationId } = command.data;
        // todo: check if new state is finalized on chain.
        // If it's finalized, read assertion from pending storage file and store in triple store PUBLIC_CURRENT repository

        await this.pendingStorageService.removeCachedAssertion(
            blockchain,
            contract,
            tokenId,
            operationId,
        );

        return Command.empty();
    }

    /**
     * Builds default movePendingStorageAssertionCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'movePendingStorageAssertionCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default MovePendingStorageAssertionCommand;
