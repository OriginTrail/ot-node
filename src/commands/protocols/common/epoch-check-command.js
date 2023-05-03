/* eslint-disable no-await-in-loop */
import Command from '../../command.js';
import { COMMAND_RETRIES } from '../../../constants/constants.js';

class EpochCheckCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.shardingTableService = ctx.shardingTableService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
    }

    async execute() {
        const schedulePromises = [];
        this.blockchainModuleManager.getImplementationNames().forEach((blockchain) => {
            schedulePromises.push([
                this.scheduleSubmitCommitCommands(blockchain),
                this.scheduleCalculateProofsCommands(blockchain),
            ]);
        });
        await Promise.all(schedulePromises);
        return Command.repeat();
    }

    async scheduleSubmitCommitCommands(blockchain) {
        const timestamp = this.blockchainModuleManager.getBlockchainTimestamp(blockchain);
        const eligibleAgreementForSubmitCommit =
            await this.repositoryModuleManager.getEligibleAgreementsForSubmitCommit(
                timestamp,
                blockchain,
            );

        for (const serviceAgreement in eligibleAgreementForSubmitCommit) {
            const rank = await this.calculateRank(
                blockchain,
                serviceAgreement.keyword,
                serviceAgreement.hash_function_id,
            );

            const r0 = await this.blockchainModuleManager.getR0(blockchain);

            if (rank >= r0) {
                this.logger.trace(
                    `Calculated rank: ${rank} higher than R0: ${r0}. Skipping scheduling of submit commit for agreement id: ${serviceAgreement.agreement_id}`,
                );
            } else {
                const epoch = await this.calculateCurrentEpoch(
                    serviceAgreement.start_time,
                    serviceAgreement.epoch_length,
                    blockchain,
                );
                const commandData = {
                    blockchain,
                    contract: serviceAgreement.asset_storage_contract_address,
                    tokenId: serviceAgreement.token_id,
                    keyword: serviceAgreement.keyword,
                    hashFunctionId: serviceAgreement.hash_function_id,
                    epoch,
                    epochStartTime: serviceAgreement.start_time,
                    epochLength: serviceAgreement.epoch_length,
                    agreementId: serviceAgreement.agreement_id,
                    stateIndex: serviceAgreement.state_index,
                };
                await this.commandExecutor.add({
                    name: 'submitCommitCommand',
                    sequence: [],
                    retries: COMMAND_RETRIES.SUBMIT_COMMIT,
                    data: commandData,
                    transactional: false,
                });
            }
        }
    }

    async scheduleCalculateProofsCommands(blockchain) {
        const timestamp = this.blockchainModuleManager.getBlockchainTimestamp(blockchain);
        const eligibleAgreementForSubmitProofs =
            await this.repositoryModuleManager.getEligibleAgreementsForSubmitProof(
                timestamp,
                blockchain,
            );
        for (const serviceAgreement in eligibleAgreementForSubmitProofs) {
            const epoch = await this.calculateCurrentEpoch(
                serviceAgreement.start_time,
                serviceAgreement.epoch_length,
                blockchain,
            );
            const eligibleForReward = await this.isEligibleForRewards(
                blockchain,
                serviceAgreement.agreement_id,
                epoch,
                serviceAgreement.state_index,
            );
            if (eligibleForReward) {
                const commandData = {
                    blockchain,
                    contract: serviceAgreement.asset_storage_contract_address,
                    tokenId: serviceAgreement.token_id,
                    keyword: serviceAgreement.keyword,
                    hashFunctionId: serviceAgreement.hash_function_id,
                    epoch,
                    agreementId: serviceAgreement.agreement_id,
                    assertionId: serviceAgreement.assertion_id,
                    stateIndex: serviceAgreement.state_index,
                };
                await this.commandExecutor.add({
                    name: 'calculateProofsCommand',
                    sequence: [],
                    data: commandData,
                    transactional: false,
                });
            }
        }
    }

    async calculateCurrentEpoch(startTime, epochLength, blockchain) {
        const now = await this.blockchainModuleManager.getBlockchainTimestamp(blockchain);
        return Math.floor((Number(now) - Number(startTime)) / Number(epochLength));
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
        for (let i = 0; i < Math.min(r0, commits.length); i += 1) {
            if (Number(commits[i].identityId) === identityId) {
                this.logger.trace(`Node is eligible for rewards for agreement id: ${agreementId}`);

                return true;
            }
        }

        this.logger.trace(`Node is not eligible for rewards for agreement id: ${agreementId}`);

        return false;
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
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default EpochCheckCommand;
