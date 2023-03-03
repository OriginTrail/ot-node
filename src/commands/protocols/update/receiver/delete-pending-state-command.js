import Command from '../../../command.js';
import { ERROR_TYPE } from '../../../../constants/constants.js';

class DeletePendingStateCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.pendingStorageService = ctx.pendingStorageService;

        this.errorType = ERROR_TYPE.UPDATE_DELETE_PENDING_STATE_ERROR;
    }

    async execute(command) {
        const { blockchain, contract, tokenId, operationId } = command.data;

        await this.pendingStorageService.removeCachedAssertion(
            blockchain,
            contract,
            tokenId,
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
