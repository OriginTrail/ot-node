import Command from '../../../command.js';

class EpochCheckCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    async execute(command) {
        const { blockchain, agreementId, epoch } = command.data;

        let { serviceAgreement } = command.data;
        if (!serviceAgreement) {
            serviceAgreement = await this.blockchainModuleManager.getServiceAgreement(
                blockchain,
                agreementId,
            );
        }

        if (this.assetLifetimeExpired(serviceAgreement, epoch)) {
            return Command.empty();
        }

        const commitOpen = await this.blockchainModuleManager.isCommitWindowOpen(
            blockchain,
            agreementId,
            epoch,
        );

        if (commitOpen) {
            const commits = await this.blockchainModuleManager.getCommitSubmissions(
                blockchain,
                agreementId,
                epoch,
            );

            const myIdentity = this.blockchainModuleManager.getIdentity(blockchain);

            const alreadyCommitted = this.alreadyCommitted(commits, myIdentity);

            if (alreadyCommitted) {
                await this.commandExecutor.add({
                    name: 'calculateProofsCommand',
                    sequence: [],
                    delay: 0,
                    data: { ...command.data, serviceAgreement },
                    transactional: false,
                });
                return Command.empty();
            }
            const myScore = await this.calculateScore();
            const previousIdentityId = this.previousIdentityId(commits, myScore);
            if (previousIdentityId) {
                await this.commandExecutor.add({
                    name: 'submitCommitCommand',
                    sequence: [],
                    delay: 0,
                    data: { ...command.data, previousIdentityId, serviceAgreement },
                    transactional: false,
                });
                return Command.empty();
            }
        }

        await this.scheduleNextEpochCheck(blockchain, agreementId, epoch, serviceAgreement);

        return Command.empty();
    }

    async calculateScore() {
        // todo calculate score
        return 10;
    }

    previousIdentityId(commits, myScore) {
        commits.forEach((commit) => {
            if (commit.score < myScore) {
                return commit.identityId;
            }
        });
    }

    alreadyCommitted(commits, myIdentity) {
        commits.forEach((commit) => {
            if (commit.identityId === myIdentity) {
                return true;
            }
        });
        return false;
    }

    async scheduleNextEpochCheck(blockchain, agreementId, currentEpoch, serviceAgreement) {
        const nextEpochStartTime =
            serviceAgreement.startTime + serviceAgreement.epochLength * currentEpoch;
        const epochCheckCommandDelay = nextEpochStartTime - Date.now();
        const commandData = {
            blockchain,
            agreementId,
            epoch: currentEpoch + 1,
            serviceAgreement,
        };
        await this.commandExecutor.add({
            name: 'epochCheckCommand',
            sequence: [],
            delay: epochCheckCommandDelay,
            data: commandData,
            transactional: false,
        });
    }

    assetLifetimeExpired(serviceAgreement, currentEpoch) {
        return serviceAgreement.epochsNum < currentEpoch;
    }

    /**
     * Builds default handleStoreInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_1HandleStoreInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default EpochCheckCommand;
