import EpochCommand from '../../common/epoch-command.js';
import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    COMMAND_RETRIES,
} from '../../../../constants/constants.js';

class SubmitCommitCommand extends EpochCommand {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.operationIdService = ctx.operationIdService;
        this.shardingTableService = ctx.shardingTableService;
        this.networkModuleManager = ctx.networkModuleManager;

        this.errorType = ERROR_TYPE.COMMIT_PROOF.SUBMIT_COMMIT_ERROR;
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
            assertionId,
            stateIndex,
        } = command.data;

        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_COMMIT_START,
            operationId,
            agreementId,
            epoch,
        );

        this.logger.trace(
            `Started ${command.name} for agreement id: ${agreementId} ` +
                `contract: ${contract}, token id: ${tokenId}, keyword: ${keyword}, ` +
                `hash function id: ${hashFunctionId}, epoch: ${epoch}, stateIndex: ${stateIndex}. Retry number ${
                    COMMAND_RETRIES.SUBMIT_COMMIT - command.retries + 1
                }`,
        );

        const commits = await this.blockchainModuleManager.getTopCommitSubmissions(
            blockchain,
            agreementId,
            epoch,
            stateIndex,
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
                assertionId,
            );
            return EpochCommand.empty();
        }

        const that = this;
        await this.blockchainModuleManager.submitCommit(
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
            async (result) => {
                if (!result.error) {
                    const currentEpochStartTime =
                        agreementData.startTime + agreementData.epochLength * epoch;

                    const proofWindowDurationPerc =
                        await that.blockchainModuleManager.getProofWindowDurationPerc(blockchain);

                    const proofWindowDuration =
                        (agreementData.epochLength * proofWindowDurationPerc) / 100;

                    const proofWindowStartTime =
                        currentEpochStartTime +
                        Math.floor(
                            (agreementData.epochLength * agreementData.proofWindowOffsetPerc) / 100,
                        );
                    // we are not using Date.now() here becouse we have an issue with hardhat blockchain time
                    const timeNow = await that.blockchainModuleManager.getBlockchainTimestamp();
                    const delay =
                        that.serviceAgreementService.randomIntFromInterval(
                            proofWindowStartTime + 0.1 * proofWindowDuration,
                            proofWindowStartTime + proofWindowDuration - 0.1 * proofWindowDuration,
                        ) - timeNow;

                    that.logger.trace(
                        `Scheduling calculateProofsCommand for agreement id: ${agreementId} in ${delay} seconds`,
                    );

                    await that.commandExecutor.add({
                        name: 'calculateProofsCommand',
                        delay: delay * 1000,
                        data: { ...command.data, proofWindowStartTime },
                        transactional: false,
                    });
                    that.operationIdService.emitChangeEvent(
                        OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_COMMIT_END,
                        operationId,
                        agreementId,
                        epoch,
                    );
                } else {
                    await that.scheduleNextEpochCheck(
                        blockchain,
                        agreementId,
                        contract,
                        tokenId,
                        keyword,
                        epoch,
                        hashFunctionId,
                        agreementData,
                        operationId,
                        assertionId,
                    );
                }
            },
        );

        return EpochCommand.empty();
    }

    async calculateRank(blockchain, keyword, hashFunctionId) {
        const r2 = await this.blockchainModuleManager.getR2(blockchain);
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
