import Command from '../../../command.js';
import { ERROR_TYPE } from '../../../../constants/constants.js';

class DeletePendingStateCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.pendingStorageService = ctx.pendingStorageService;

        this.errorType = ERROR_TYPE.UPDATE.UPDATE_DELETE_PENDING_STATE_ERROR;
    }

    async execute(command) {
        const { repository, blockchain, contract, tokenId, assertionId, operationId } =
            command.data;

        await this.pendingStorageService.removeCachedAssertion(
            repository,
            blockchain,
            contract,
            tokenId,
            assertionId,
            operationId,
        );

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
