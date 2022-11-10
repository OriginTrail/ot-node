import Command from '../../../command.js';

class SubmitCommitCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    async execute(command) {
        const { agreementId, epoch, blockchain, prevIdentityId } = command.data;
        await this.blockchainModuleManager.submitCommit(
            blockchain,
            agreementId,
            epoch,
            prevIdentityId,
        );

        await this.commandExecutor.add({
            name: 'calculateProofsCommand',
            delay: 0,
            data: command.data,
            transactional: false,
        });
        return Command.empty();
    }

    /**
     * Builds default handleStoreInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'submitCommitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default SubmitCommitCommand;
