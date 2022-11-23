import { AGREEMENT_STATUS, OPERATION_ID_STATUS } from '../../../../constants/constants.js';
import Command from '../../../command.js';

class EpochCheckCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.operationIdService = ctx.operationIdService;
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

        this.logger.trace(
            `Started epoch check command for agreement id: ${agreementId} contract: ${contract}, token id: ${tokenId}, keyword: ${keyword}, hash function id: ${hashFunctionId}`,
        );
        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.EPOCH_CHECK_START,
            operationId,
            agreementId,
            epoch,
        );
        let { serviceAgreement } = command.data;
        if (!serviceAgreement) {
            serviceAgreement = await this.serviceAgreementService.getServiceAgreementData(
                blockchain,
                agreementId,
            );
        }

        if (this.assetLifetimeExpired(serviceAgreement, epoch)) {
            this.logger.trace(`Asset life time for agreement id: ${agreementId} expired.`);
            await this.repositoryModuleManager.updateOperationAgreementStatus(
                operationId,
                agreementId,
                AGREEMENT_STATUS.EXPIRED,
            );
            this.finishEpochCheckCommand(operationId, agreementId, epoch);
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
            this.logger.trace(
                `Commit window for for agreement id: ${agreementId} not open. Scheduling next epoch check.`,
            );
            await this.scheduleNextEpochCheck(
                blockchain,
                agreementId,
                contract,
                tokenId,
                epoch,
                serviceAgreement,
            );
            return this.finishEpochCheckCommand(operationId, agreementId, epoch);
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
            this.logger.trace(
                `Current epoch's commit has already been submitted for for agreement id: ${agreementId}.`,
            );
            await this.commandExecutor.add({
                name: 'calculateProofsCommand',
                sequence: [],
                delay: 0,
                data: { ...command.data, serviceAgreement, identityId },
                transactional: false,
            });
            return this.finishEpochCheckCommand(operationId, agreementId, epoch);
        }

        // submit commit -> calculate proofs -> schedule proof submission -> schedule next epoch
        const { prevIdentityId, rank } = await this.getPreviousIdentityIdAndRank(
            blockchain,
            commits,
            keyword,
            hashFunctionId,
        );

        const r1 = await this.blockchainModuleManager.getR1(blockchain);
        if (rank < r1) {
            this.logger.trace(
                `Calculated rank: ${rank} lower than R1: ${r1}. Agreement id: ${agreementId}`,
            );
            await this.commandExecutor.add({
                name: 'submitCommitCommand',
                sequence: [],
                delay: 0,
                data: { ...command.data, prevIdentityId, serviceAgreement, identityId },
                transactional: false,
            });
        }

        return this.finishEpochCheckCommand(operationId, agreementId, epoch);
    }

    finishEpochCheckCommand(operationId, agreementId, epoch) {
        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.EPOCH_CHECK_END,
            operationId,
            agreementId,
            epoch,
        );
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
