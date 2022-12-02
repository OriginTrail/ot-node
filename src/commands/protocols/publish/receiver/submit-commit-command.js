import EpochCommand from '../../common/epoch-command.js';
import { OPERATION_ID_STATUS, ERROR_TYPE } from '../../../../constants/constants.js';

class SubmitCommitCommand extends EpochCommand {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.operationIdService = ctx.operationIdService;
        this.shardingTableService = ctx.shardingTableService;
        this.networkModuleManager = ctx.networkModuleManager;

        this.errorType = ERROR_TYPE.SUBMIT_COMMIT_ERROR;
    }

    async execute(command) {
        const {
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
            agreementData,
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

        const commits = await this.blockchainModuleManager.getTopCommitSubmissions(
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
                data: { ...command.data, agreementData, identityId },
                transactional: false,
            });
            return EpochCommand.empty();
        }

        this.logger.trace(
            `Calculating commit submission score for agreement id: ${agreementId}...`,
        );

        // submit commit -> calculate proofs -> schedule proof submission -> schedule next epoch
        const rank = await this.calculateRank(blockchain, keyword, hashFunctionId);

        const r0 = await this.blockchainModuleManager.getR0(blockchain);

        if (rank >= r0) {
            this.logger.trace(
                `Calculated rank: ${rank} higher than R0: ${r0}. Scheduling next epoch check for agreement id: ${agreementId}`,
            );
            await this.scheduleNextEpochCheck(
                blockchain,
                agreementId,
                contract,
                tokenId,
                keyword,
                epoch,
                hashFunctionId,
                agreementData,
                operationId,
            );
            return EpochCommand.empty();
        }

        try {
            await this.blockchainModuleManager.submitCommit(
                blockchain,
                contract,
                tokenId,
                keyword,
                hashFunctionId,
                epoch,
            );
        } catch (error) {
            this.logger.warn(error.message);
            return EpochCommand.retry();
        }

        const endOffset = 30; // 30 sec

        const currentEpochStartTime =
            Number(agreementData.startTime) + Number(agreementData.epochLength) * epoch;

        const proofWindowDurationPerc = Number(
            await this.blockchainModuleManager.getProofWindowDurationPerc(blockchain),
        );

        const proofWindowDuration =
            (proofWindowDurationPerc / 100) * Number(agreementData.epochLength);

        const proofWindowStartTime =
            currentEpochStartTime +
            Math.floor(
                (Number(agreementData.epochLength) * Number(agreementData.proofWindowOffsetPerc)) /
                    100,
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

    async calculateRank(blockchain, keyword, hashFunctionId) {
        const r2 = Number(await this.blockchainModuleManager.getR2(blockchain));
        const neighbourhood = await this.shardingTableService.findNeighbourhood(
            blockchain,
            keyword,
            r2,
            hashFunctionId,
            false,
        );

        const scores = await Promise.all(
            neighbourhood.map(async (node) => ({
                score: await this.serviceAgreementService.calculateScore(
                    node.peer_id,
                    blockchain,
                    keyword,
                    hashFunctionId,
                ),
                peerId: node.peer_id,
            })),
        );

        scores.sort((a, b) => b.score - a.score);

        return scores.findIndex(
            (node) => node.peerId === this.networkModuleManager.getPeerId().toB58String(),
        );
    }

    alreadyCommitted(commits, myIdentity) {
        commits.forEach((commit) => {
            if (Number(commit.identityId) === myIdentity) {
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
