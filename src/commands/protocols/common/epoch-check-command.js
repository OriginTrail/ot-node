/* eslint-disable no-await-in-loop */
import Command from '../../command.js';
import { COMMAND_RETRIES, TRANSACTION_CONFIRMATIONS } from '../../../constants/constants.js';

class EpochCheckCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.networkModuleManager = ctx.networkModuleManager;
        this.shardingTableService = ctx.shardingTableService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
    }

    async execute(command) {
        await Promise.all(
            this.blockchainModuleManager.getImplementationNames().flatMap(async (blockchain) => {
                const commitWindowDurationPerc =
                    await this.blockchainModuleManager.getCommitWindowDurationPerc(blockchain);
                const proofWindowDurationPerc =
                    await this.blockchainModuleManager.getProofWindowDurationPerc(blockchain);
                const totalTransactions = await this.calculateTotalTransactions(
                    blockchain,
                    commitWindowDurationPerc,
                    proofWindowDurationPerc,
                    command.period,
                );
                return [
                    this.scheduleSubmitCommitCommands(
                        blockchain,
                        Math.floor(totalTransactions / 2),
                        commitWindowDurationPerc,
                    ),
                    this.scheduleCalculateProofsCommands(
                        blockchain,
                        Math.ceil(totalTransactions / 2),
                        proofWindowDurationPerc,
                    ),
                ];
            }),
        );
        return Command.repeat();
    }

    async scheduleSubmitCommitCommands(blockchain, maxTransactions, commitWindowDurationPerc) {
        const timestamp = await this.blockchainModuleManager.getBlockchainTimestamp(blockchain);
        const eligibleAgreementForSubmitCommit =
            await this.repositoryModuleManager.getEligibleAgreementsForSubmitCommit(
                timestamp,
                blockchain,
                commitWindowDurationPerc,
            );

        const scheduleSubmitCommitCommands = [];
        const updateServiceAgreementsLastCommitEpoch = [];
        for (const serviceAgreement of eligibleAgreementForSubmitCommit) {
            if (scheduleSubmitCommitCommands.length >= maxTransactions) break;

            const rank = await this.calculateRank(
                blockchain,
                serviceAgreement.keyword,
                serviceAgreement.hash_function_id,
            );

            const r0 = await this.blockchainModuleManager.getR0(blockchain);

            if (rank < r0) {
                scheduleSubmitCommitCommands.push(
                    this.scheduleSubmitCommitCommand(serviceAgreement),
                );
            } else {
                this.logger.trace(
                    `Calculated rank: ${
                        rank + 1
                    } higher than R0: ${r0}. Skipping scheduling of submit commit for agreement id: ${
                        serviceAgreement.agreement_id
                    }`,
                );
            }

            updateServiceAgreementsLastCommitEpoch.push(
                this.repositoryModuleManager.updateServiceAgreementLastCommitEpoch(
                    serviceAgreement.agreement_id,
                    serviceAgreement.current_epoch,
                ),
            );
        }
        await Promise.all([
            ...scheduleSubmitCommitCommands,
            ...updateServiceAgreementsLastCommitEpoch,
        ]);
    }

    async scheduleCalculateProofsCommands(blockchain, maxTransactions, proofWindowDurationPerc) {
        const timestamp = await this.blockchainModuleManager.getBlockchainTimestamp(blockchain);
        const eligibleAgreementsForSubmitProofs =
            await this.repositoryModuleManager.getEligibleAgreementsForSubmitProof(
                timestamp,
                blockchain,
                proofWindowDurationPerc,
            );
        const scheduleSubmitProofCommands = [];
        const updateServiceAgreementsLastProofEpoch = [];
        for (const serviceAgreement of eligibleAgreementsForSubmitProofs) {
            if (scheduleSubmitProofCommands.length >= maxTransactions) break;

            const eligibleForReward = await this.isEligibleForRewards(
                blockchain,
                serviceAgreement.agreement_id,
                serviceAgreement.current_epoch,
                serviceAgreement.state_index,
            );
            if (eligibleForReward) {
                this.logger.trace(
                    `Node is eligible for rewards for agreement id: ${serviceAgreement.agreement_id}`,
                );

                scheduleSubmitProofCommands.push(
                    this.scheduleSubmitProofsCommand(serviceAgreement),
                );
            } else {
                this.logger.trace(
                    `Node is not eligible for rewards for agreement id: ${serviceAgreement.agreement_id}`,
                );
            }
            updateServiceAgreementsLastProofEpoch.push(
                this.repositoryModuleManager.updateServiceAgreementLastProofEpoch(
                    serviceAgreement.agreement_id,
                    serviceAgreement.current_epoch,
                ),
            );
        }
        await Promise.all([
            ...scheduleSubmitProofCommands,
            ...updateServiceAgreementsLastProofEpoch,
        ]);
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

    async isEligibleForRewards(blockchain, agreementId, epoch, stateIndex) {
        const r0 = await this.blockchainModuleManager.getR0(blockchain);
        const identityId = await this.blockchainModuleManager.getIdentityId(blockchain);
        const commits = await this.blockchainModuleManager.getTopCommitSubmissions(
            blockchain,
            agreementId,
            epoch,
            stateIndex,
        );

        for (const commit of commits.slice(0, r0)) {
            if (Number(commit.identityId) === identityId && Number(commit.score) !== 0) {
                return true;
            }
        }

        return false;
    }

    async scheduleSubmitCommitCommand(agreement) {
        const commandData = {
            blockchain: agreement.blockchain_id,
            contract: agreement.asset_storage_contract_address,
            tokenId: agreement.token_id,
            keyword: agreement.keyword,
            hashFunctionId: agreement.hash_function_id,
            epoch: agreement.current_epoch,
            agreementId: agreement.agreement_id,
            stateIndex: agreement.state_index,
        };

        await this.commandExecutor.add({
            name: 'submitCommitCommand',
            sequence: [],
            retries: COMMAND_RETRIES.SUBMIT_COMMIT,
            data: commandData,
            transactional: false,
        });
    }

    async scheduleSubmitProofsCommand(agreement) {
        const commandData = {
            blockchain: agreement.blockchain_id,
            contract: agreement.asset_storage_contract_address,
            tokenId: agreement.token_id,
            keyword: agreement.keyword,
            hashFunctionId: agreement.hash_function_id,
            epoch: agreement.current_epoch,
            agreementId: agreement.agreement_id,
            assertionId: agreement.assertion_id,
            stateIndex: agreement.state_index,
        };

        return this.commandExecutor.add({
            name: 'submitProofsCommand',
            sequence: [],
            data: commandData,
            retries: COMMAND_RETRIES.SUBMIT_PROOFS,
            transactional: false,
        });
    }

    async calculateTotalTransactions(
        blockchain,
        commitWindowDurationPerc,
        proofWindowDurationPerc,
        commandPeriod,
    ) {
        const epochLength = await this.blockchainModuleManager.getEpochLength(blockchain);

        const commitWindowDuration = (epochLength * commitWindowDurationPerc) / 100;
        const proofWindowDuration = (epochLength * proofWindowDurationPerc) / 100;

        const totalTransactionTime = Math.min(commitWindowDuration, proofWindowDuration);

        const blockTime = this.blockchainModuleManager.getBlockTimeMillis(blockchain) / 1000;
        const timePerTransaction = blockTime * TRANSACTION_CONFIRMATIONS;

        const totalTransactions = Math.floor(totalTransactionTime / timePerTransaction);

        const epochChecksInWindow = Math.floor(totalTransactionTime / (commandPeriod / 1000));

        const transactionsPerEpochCheck = Math.floor(totalTransactions / epochChecksInWindow);

        return transactionsPerEpochCheck;
    }

    calculateCommandPeriod() {
        const devEnvironment =
            process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

        return devEnvironment ? 30_000 : 120_000;
    }

    /**
     * Recover system from failure
     * @param command
     * @param error
     */
    async recover(command, error) {
        this.logger.warn(`Failed to execute ${command.name}: error: ${error.message}`);

        return Command.repeat();
    }

    /**
     * Builds default epochCheckCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'epochCheckCommand',
            data: {},
            transactional: false,
            period: this.calculateCommandPeriod(),
        };
        Object.assign(command, map);
        return command;
    }
}

export default EpochCheckCommand;
