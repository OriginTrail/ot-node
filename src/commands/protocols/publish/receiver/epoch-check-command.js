import Command from '../../../command.js';

class EpochCheckCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    async execute(command) {
        const { blockchain, uai, epoch } = command.data;

        // todo check if this is the end of the liftime for the asset

        const commitOpen = this.blockchainModuleManager.isCommitWindowOpen(blockchain, uai, epoch);

        if (commitOpen) {
            const commits = await this.blockchainModuleManager.getCommits(blockchain, uai, epoch);

            const myIdentity = this.blockchainModuleManager.getIdentity(blockchain);

            const alreadyCommitted = this.alreadyCommitted(commits, myIdentity);

            if (alreadyCommitted) {
                await this.commandExecutor.add({
                    name: 'calculateProofsCommand',
                    sequence: [],
                    delay: 0,
                    data: command.data,
                    transactional: false,
                });
                return Command.empty();
            }
            const myScore = await this.calculateScore();

            if (this.iCanWin(commits, myScore)) {
                await this.commandExecutor.add({
                    name: 'submitCommitCommand',
                    sequence: [],
                    delay: 0,
                    data: command.data,
                    transactional: false,
                });
                return Command.empty();
            }
        }

        await this.scheduleNextEpochCheck(blockchain, uai, epoch);

        return Command.empty();
    }

    async calculateScore() {
        // todo calculate score
        return 10;
    }

    iCanWin(commits, myScore) {
        if (commits.length < 3) {
            return true;
        }
        commits.forEach((commit) => {
            if (commit.score < myScore) {
                return true;
            }
        });
        return false;
    }

    alreadyCommitted(commits, myIdentity) {
        commits.forEach((commit) => {
            if (commit.identityId === myIdentity) {
                return true;
            }
        });
        return false;
    }

    async recover(command, err) {
        await super.recover(command, err);
    }

    async scheduleNextEpochCheck(blockchain, uai, currentEpoch) {
        // todo calculate next epoch check delay
        const epochCheckCommandDelay = 10;
        const commandData = {
            blockchain,
            uai,
            epoch: currentEpoch + 1,
        };
        await this.commandExecutor.add({
            name: 'epochCheckCommand',
            sequence: [],
            delay: epochCheckCommandDelay,
            data: commandData,
            transactional: false,
        });
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
