import { AGREEMENT_STATUS } from '../../../../constants/constants.js';
import Command from '../../../command.js';

class EpochCheckCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
    }

    async execute(command) {
        const {
            blockchain,
            agreementId,
            contract,
            tokenId,
            keyword,
            epoch,
            hashFunctionId,
            operationId,
        } = command.data;

        let { serviceAgreement } = command.data;
        if (!serviceAgreement) {
            serviceAgreement = await this.serviceAgreementService.getServiceAgreementData(
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

        // Time on ganache isn't increasing without txs,
        // needed for commit-proof phase to work using local blockchain
        await this.blockchainModuleManager.increaseGanacheTime(30);

        const commitWindowOpen = await this.blockchainModuleManager.isCommitWindowOpen(
            blockchain,
            agreementId,
            epoch,
        );

        if (!commitWindowOpen) {
            await this.scheduleNextEpochCheck(
                blockchain,
                agreementId,
                contract,
                tokenId,
                epoch,
                serviceAgreement,
            );
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
        const { prevIdentityId, rank } = await this.getPreviousIdentityIdAndRank(
            blockchain,
            commits,
            keyword,
            hashFunctionId,
        );

        if (rank < (await this.blockchainModuleManager.getR1(blockchain))) {
            await this.commandExecutor.add({
                name: 'submitCommitCommand',
                sequence: [],
                delay: 0,
                data: { ...command.data, prevIdentityId, serviceAgreement, identityId },
                transactional: false,
            });
        }
        return Command.empty();
    }

    async getPreviousIdentityIdAndRank(blockchain, commits, keyword, hashFunctionId) {
        const score = await this.serviceAgreementService.calculateScore(
            blockchain,
            keyword,
            hashFunctionId,
        );

        [...commits].reverse().forEach((commit, index) => {
            if (Number(commit.score) > score) {
                return {
                    prevIdentityId: Number(commit.identityId),
                    rank: commits.length - index - 1,
                };
            }
        });
        return { prevIdentityId: 0, rank: 0 };
    }

    alreadyCommitted(commits, myIdentity) {
        commits.forEach((commit) => {
            if (commit.identityId === myIdentity) {
                return true;
            }
        });
        return false;
    }

    async scheduleNextEpochCheck(
        blockchain,
        agreementId,
        contract,
        tokenId,
        keyword,
        epoch,
        hashFunctionId,
        serviceAgreement,
    ) {
        const nextEpochStartTime =
            serviceAgreement.startTime + serviceAgreement.epochLength * (epoch + 1);
        await this.commandExecutor.add({
            name: 'epochCheckCommand',
            sequence: [],
            delay: nextEpochStartTime - Math.floor(Date.now() / 1000),
            data: {
                blockchain,
                agreementId,
                contract,
                tokenId,
                keyword,
                epoch: epoch + 1,
                hashFunctionId,
                serviceAgreement,
            },
            transactional: false,
        });
    }

    assetLifetimeExpired(serviceAgreement, epoch) {
        return serviceAgreement.epochsNumber < epoch;
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
