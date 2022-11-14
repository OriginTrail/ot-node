import Command from '../../../command.js';
import { AGREEMENT_STATUS } from '../../../../constants/constants.js';
import blockchainModuleManager from '../../../../modules/blockchain/blockchain-module-manager';

class EpochCheckCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
    }

    async execute(command) {
        const { blockchain, agreementId, epoch, operationId } = command.data;

        let { serviceAgreement } = command.data;
        if (!serviceAgreement) {
            serviceAgreement = await this.blockchainModuleManager.getServiceAgreement(
                blockchain,
                agreementId,
            );
        }

        if (this.assetLifetimeExpired(serviceAgreement, epoch)) {
            await this.repositoryModuleManager.updateOperationAgreementStatus(
                operationId,
                agreementId,
                AGREEMENT_STATUS.EXPIRED,
            );
            return Command.empty();
        }
        const commitWindowOpen = await this.blockchainModuleManager.isCommitWindowOpen(
            blockchain,
            agreementId,
            epoch,
        );

        if (!commitWindowOpen) {
            await this.scheduleNextEpochCheck(blockchain, agreementId, epoch, serviceAgreement);
            return Command.empty();
        }

        const commits = await this.blockchainModuleManager.getCommitSubmissions(
            blockchain,
            agreementId,
            epoch,
        );

        const identityId =
            command.data.identityId ??
            (await this.blockchainModuleManager.getIdentityId(blockchain));

        // calculate proofs -> schedule proof submission -> schedule next epoch
        if (this.alreadyCommitted(commits, identityId)) {
            await this.commandExecutor.add({
                name: 'calculateProofsCommand',
                sequence: [],
                delay: 0,
                data: { ...command.data, serviceAgreement, identityId },
                transactional: false,
            });
            return Command.empty();
        }

        // submit commit -> calculate proofs -> schedule proof submission -> schedule next epoch
        const { prevId, rank } = this.getPreviousIdentityIdAndRank(commits);

        if (rank < (await this.blockchainModuleManager.getR1(blockchain))) {
            const commitWindowDuration = await blockchainModuleManager.getCommitWindowDuration(
                blockchain,
            );
            const currentEpochStartTime =
                serviceAgreement.startTime + serviceAgreement.epochLength * (epoch - 1);

            const startEndOffset = 60000; // 1 min

            const delay =
                this.serviceAgreementService.randomIntFromInterval(
                    currentEpochStartTime + startEndOffset,
                    commitWindowDuration - startEndOffset,
                ) - Date.now();

            await this.commandExecutor.add({
                name: 'submitCommitCommand',
                sequence: [],
                delay,
                data: { ...command.data, prevId, serviceAgreement, identityId },
                transactional: false,
            });
        }
        return Command.empty();
    }

    getPreviousIdentityIdAndRank(commits) {
        const score = this.serviceAgreementService.calculateScore();

        [...commits].reverse().forEach((commit, index) => {
            if (commit.score > score) {
                return { prevId: commit.identityId, rank: commits.length - index - 1 };
            }
        });
        return { prevId: '', rank: 0 };
    }

    alreadyCommitted(commits, myIdentity) {
        commits.forEach((commit) => {
            if (commit.identityId === myIdentity) {
                return true;
            }
        });
        return false;
    }

    async scheduleNextEpochCheck(blockchain, agreementId, epoch, serviceAgreement) {
        const nextEpochStartTime =
            serviceAgreement.startTime + serviceAgreement.epochLength * epoch;
        await this.commandExecutor.add({
            name: 'epochCheckCommand',
            sequence: [],
            delay: nextEpochStartTime - Date.now(),
            data: {
                blockchain,
                agreementId,
                epoch: epoch + 1,
                serviceAgreement,
            },
            transactional: false,
        });
    }

    assetLifetimeExpired(serviceAgreement, epoch) {
        return serviceAgreement.epochsNum < epoch;
    }

    /**
     * Builds default handleStoreInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'epochCheckCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default EpochCheckCommand;
