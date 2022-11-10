import Command from '../../../command.js';

class SubmitProofsCommand extends Command {
    constructor(ctx) {
        super(ctx);

        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    async execute(command) {
        const { blockchain, proofs, serviceAgreement, epoch, agreementId } = command.data;

        // submit proofs
        await this.blockchainModuleManager.submitProof(blockchain, proofs);

        const nextEpochStartTime =
            serviceAgreement.startTime + serviceAgreement.epochLength * epoch;
        const epochCheckCommandDelay = nextEpochStartTime - Date.now();
        const commandData = {
            blockchain,
            agreementId,
            epoch: epoch + 1,
            serviceAgreement,
        };
        await this.commandExecutor.add({
            name: 'epochCheckCommand',
            sequence: [],
            delay: epochCheckCommandDelay,
            data: commandData,
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
            name: 'submitProofsCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default SubmitProofsCommand;
