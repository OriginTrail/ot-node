import EpochCommand from '../../common/epoch-command.js';
import { OPERATION_ID_STATUS } from '../../../../constants/constants.js';

class SubmitCommitCommand extends EpochCommand {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.operationIdService = ctx.operationIdService;
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
            operationId,
        } = command.data;
        
        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_COMMIT_START,
            operationId,
            agreementId,
            epoch,
        );

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
            return EpochCommand.empty();
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
                operationId,
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
            this.logger.warn(error.message);
            return EpochCommand.retry();
        }

        const endOffset = 30; // 30 sec

        const currentEpochStartTime =
            serviceAgreement.startTime + serviceAgreement.epochLength * epoch;

        const proofWindowDurationPerc =
            await this.blockchainModuleManager.getProofWindowDurationPerc(blockchain);

        const proofWindowDuration = (proofWindowDurationPerc / 100) * serviceAgreement.epochLength;

        const proofWindowStartTime =
            currentEpochStartTime +
            Math.floor(
                (serviceAgreement.epochLength * serviceAgreement.proofWindowOffsetPerc) / 100,
            );

        const timeNow = Math.floor(Date.now() / 1000);
        const delay = this.serviceAgreementService.randomIntFromInterval(
            proofWindowStartTime - timeNow,
            proofWindowStartTime + proofWindowDuration - timeNow - endOffset,
        );

        this.logger.trace(
            `Scheduling calculateProofsCommand for agreement id: ${agreementId} in ${delay} seconds`,
        );

        await this.commandExecutor.add({
            name: 'calculateProofsCommand',
            delay,
            data: { ...command.data, proofWindowStartTime },
            transactional: false,
        });
this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_COMMIT_END,
            operationId,
            agreementId,
            epoch,
        );
        return EpochCommand.empty();
    }

    async getPreviousIdentityIdAndRank(blockchain, commits, keyword, hashFunctionId) {
        const score = await this.serviceAgreementService.calculateScore(
            blockchain,
            keyword,
            hashFunctionId,
        );

        this.logger.trace(`Commit submissions score: ${score}`);

        for (let i = commits.length - 1; i >= 0; i -= 1) {
            if (commits[i].score > score) {
                return {
                    prevIdentityId: commits[i].identityId,
                    rank: i + 1,
                };
            }
        }

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
