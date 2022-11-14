import Command from '../../../command.js';

class SubmitCommitCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
    }

    async execute(command) {
        const { epoch, blockchain, prevIdentityId, tokenId, contract, hashingAlgorithm } =
            command.data;

        const proofPhaseStartTime = await this.blockchainModuleManager.submitCommit(
            blockchain,
            tokenId,
            contract,
            hashingAlgorithm,
            epoch,
            prevIdentityId,
        );

        await this.commandExecutor.add({
            name: 'calculateProofsCommand',
            delay: proofPhaseStartTime - Date.now(),
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
