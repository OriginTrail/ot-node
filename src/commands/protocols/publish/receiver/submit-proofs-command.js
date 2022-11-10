import Command from '../../../command.js';

class SubmitProofsCommand extends Command {
    constructor(ctx) {
        super(ctx);

        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    async execute(command) {
        const { proofs } = command.data;

        // submit proofs
        await this.blockchainModuleManager.submitProof(proofs);
        const assetLifetimeEnds = true;

        if (!assetLifetimeEnds) {
            const nextEpochDelay = 10;
            const commandData = {};
            await this.commandExecutor.add({
                name: 'epochCheckCommand',
                delay: nextEpochDelay,
                data: commandData,
                transactional: false,
            });
        }

        return Command.empty();
    }

    async recover(command, err) {
        await super.recover(command, err);
    }

    /**
     * Builds default handleStoreInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'submitProofsCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default SubmitProofsCommand;
