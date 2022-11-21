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
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
            prevIdentityId,
            serviceAgreement,
        } = command.data;

        const proofPhaseStartTime = await this.blockchainModuleManager.submitCommit(
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
            prevIdentityId,
        );

        const endOffset = 30; // 30 sec

        const proofWindowDurationPerc =
            await this.blockchainModuleManager.getProofWindowDurationPerc();
        const proofWindowDuration = Math.floor(
            (serviceAgreement.epochLength * proofWindowDurationPerc) / 100,
        );
        const timeNow = Math.floor(Date.now() / 1000);
        const delay = this.serviceAgreementService.randomIntFromInterval(
            0,
            proofWindowDuration - (timeNow - proofPhaseStartTime) - endOffset,
        );

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
