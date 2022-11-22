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

        this.logger.trace(
            `Started submit commit command for agreement id: ${command.data.agreementId} ` +
                `contract: ${contract}, token id: ${tokenId}, keyword: ${keyword}, ` +
                `hash function id: ${hashFunctionId}`,
        );

        await this.blockchainModuleManager.submitCommit(
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
            prevIdentityId,
        );

        const endOffset = 30; // 30 sec

        const currentEpochStartTime =
            serviceAgreement.startTime + serviceAgreement.epochLength * epoch;

        const commitWindowDuration = await this.blockchainModuleManager.getCommitWindowDuration(
            blockchain,
        );

        const proofWindowStartTime =
            currentEpochStartTime +
            Math.floor(
                (serviceAgreement.epochLength * serviceAgreement.proofWindowOffsetPerc) / 100,
            );

        const timeNow = Math.floor(Date.now() / 1000);
        const delay = this.serviceAgreementService.randomIntFromInterval(
            currentEpochStartTime + commitWindowDuration - timeNow,
            proofWindowStartTime - endOffset - timeNow,
        );

        await this.commandExecutor.add({
            name: 'calculateProofsCommand',
            delay,
            data: { ...command.data, proofWindowStartTime },
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
