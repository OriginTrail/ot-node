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
            serviceAgreement,
            agreementId,
            identityId,
        } = command.data;

        this.logger.trace(
            `Started ${command.name} for agreement id: ${command.data.agreementId} ` +
                `contract: ${contract}, token id: ${tokenId}, keyword: ${keyword}, ` +
                `hash function id: ${hashFunctionId}`,
        );

        const commits = await this.blockchainModuleManager.getCommitSubmissions(
            blockchain,
            agreementId,
            epoch,
        );

        this.logger.trace('Commit submissions:');
        this.logger.trace(JSON.stringify(commits, null, 1));

        // calculate proofs -> schedule proof submission -> schedule next epoch
        if (this.alreadyCommitted(commits, identityId)) {
            // How this even possible?
            this.logger.trace(
                `Current epoch's commit has already been submitted for agreement id: ${agreementId}.`,
            );
            await this.commandExecutor.add({
                name: 'calculateProofsCommand',
                sequence: [],
                delay: 0, // We should calculate proofs after commit phase end + only for winning nodes.
                data: { ...command.data, serviceAgreement, identityId },
                transactional: false,
            });
            return Command.empty();
        }

        this.logger.trace(
            `Calculating commit submission score for agreement id: ${agreementId}...`,
        );

        // submit commit -> calculate proofs -> schedule proof submission -> schedule next epoch
        const { prevIdentityId, rank } = await this.getPreviousIdentityIdAndRank(
            blockchain,
            commits,
            keyword,
            hashFunctionId,
        );

        const r1 = await this.blockchainModuleManager.getR1(blockchain);

        if (rank >= r1) {
            this.logger.trace(
                `Calculated rank: ${rank} higher than R1: ${r1}. Scheduling next epoch check for agreement id: ${agreementId}`,
            );
            await this.scheduleNextEpochCheck(
                blockchain,
                agreementId,
                contract,
                tokenId,
                keyword,
                epoch,
                hashFunctionId,
                serviceAgreement,
            );
        }

        try {
            await this.blockchainModuleManager.submitCommit(
                blockchain,
                contract,
                tokenId,
                keyword,
                hashFunctionId,
                epoch,
                prevIdentityId,
            );
        } catch (error) {
            if (command.retries) {
                this.logger.warn(error.message);
                return Command.retry();
            }
            await this.handleError(error.message, command);
        }

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

    alreadyCommitted(commits, myIdentity) {
        commits.forEach((commit) => {
            if (commit.identityId === myIdentity) {
                return true;
            }
        });
        return false;
    }

    /**
     * Recover system from failure
     * @param command
     * @param error
     */
    async recover(command, error) {
        this.logger.warn(`Failed to execute epoch check command: error: ${error.message}`);

        await this.scheduleNextEpochCheck(
            command.data.blockchain,
            command.data.agreementId,
            command.data.contract,
            command.data.tokenId,
            command.data.keyword,
            command.data.epoch,
            command.data.hashFunctionId,
            command.data.serviceAgreement,
        );

        return Command.empty();
    }

    async retryFinished(command) {
        this.recover(command, `Max retry count for command: ${command.name} reached!`);
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
