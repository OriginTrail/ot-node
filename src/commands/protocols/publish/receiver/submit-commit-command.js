import Command from '../../../command.js';

class SubmitCommitCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
    }

    async execute(command) {
        const {
            epoch,
            blockchain,
            prevIdentityId,
            tokenId,
            contract,
            hashingAlgorithm,
            serviceAgreement,
        } = command.data;

        const proofPhaseStartTime = await this.blockchainModuleManager.submitCommit(
            blockchain,
            tokenId,
            contract,
            hashingAlgorithm,
            epoch,
            prevIdentityId,
        );
        const startEndOffset = 60000; // 1 min

        const proofWindowDurationPerc =
            await this.blockchainModuleManager.getProofWindowDurationPerc();
        const proofWindowDuration = Math.floor(
            (serviceAgreement.epochLength * proofWindowDurationPerc) / 100,
        );
        const delay =
            this.serviceAgreementService.randomIntFromInterval(
                proofPhaseStartTime + startEndOffset,
                proofWindowDuration - startEndOffset,
            ) - Date.now();

        await this.commandExecutor.add({
            name: 'calculateProofsCommand',
            delay,
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
