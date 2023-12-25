/* eslint-disable no-await-in-loop */
import Command from '../../command.js';
import {
    COMMAND_QUEUE_PARALLELISM,
    COMMAND_RETRIES,
    TRANSACTION_CONFIRMATIONS,
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    NODE_ENVIRONMENTS,
} from '../../../constants/constants.js';
import MigrationExecutor from '../../../migration/migration-executor.js';

class EpochCheckCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.networkModuleManager = ctx.networkModuleManager;
        this.shardingTableService = ctx.shardingTableService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.fileService = ctx.fileService;

        this.errorType = ERROR_TYPE.COMMIT_PROOF.EPOCH_CHECK_ERROR;
    }

    async execute(command) {
        const migrationExecuted = await MigrationExecutor.migrationAlreadyExecuted(
            'ualExtensionTripleStoreMigration',
            this.fileService,
        );
        if (
            process.env.NODE_ENV !== NODE_ENVIRONMENTS.DEVELOPMENT &&
            process.env.NODE_ENV !== NODE_ENVIRONMENTS.TEST &&
            !migrationExecuted
        ) {
            this.logger.info(
                'Epoch check command will be postponed until ual extension triple store migration is completed',
            );
            return Command.repeat();
        }
        this.logger.info('Starting epoch check command');
        const operationId = this.operationIdService.generateId();

        await Promise.all(
            this.blockchainModuleManager.getImplementationNames().map(async (blockchain) => {
                this.operationIdService.emitChangeEvent(
                    OPERATION_ID_STATUS.COMMIT_PROOF.EPOCH_CHECK_START,
                    operationId,
                    blockchain,
                );

                const commitWindowDurationPerc =
                    await this.blockchainModuleManager.getCommitWindowDurationPerc(blockchain);
                const proofWindowDurationPerc =
                    await this.blockchainModuleManager.getProofWindowDurationPerc(blockchain);
                let totalTransactions = await this.calculateTotalTransactions(
                    blockchain,
                    commitWindowDurationPerc,
                    proofWindowDurationPerc,
                    command.period,
                );

                // We don't expect to have this many transactions in one epoch check window.
                // This is just to make sure we don't schedule too many commands and block the queue
                // TODO: find general solution for all commands scheduling blockchain transactions
                totalTransactions = Math.min(totalTransactions, COMMAND_QUEUE_PARALLELISM * 0.3);

                const transactionQueueLength =
                    this.blockchainModuleManager.getTransactionQueueLength(blockchain);
                if (transactionQueueLength >= totalTransactions) return;

                totalTransactions -= transactionQueueLength;

                const [r0, r2] = await Promise.all([
                    this.blockchainModuleManager.getR0(blockchain),
                    this.blockchainModuleManager.getR2(blockchain),
                ]);

                await Promise.all([
                    this.scheduleSubmitCommitCommands(
                        blockchain,
                        Math.floor(totalTransactions / 2),
                        commitWindowDurationPerc,
                        r0,
                        r2,
                    ),
                    this.scheduleCalculateProofsCommands(
                        blockchain,
                        Math.ceil(totalTransactions / 2),
                        proofWindowDurationPerc,
                        r0,
                    ),
                ]);

                this.operationIdService.emitChangeEvent(
                    OPERATION_ID_STATUS.COMMIT_PROOF.EPOCH_CHECK_END,
                    operationId,
                    blockchain,
                );
            }),
        );

        return Command.repeat();
    }

    async scheduleSubmitCommitCommands(
        blockchain,
        maxTransactions,
        commitWindowDurationPerc,
        r0,
        r2,
    ) {
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

            try {
                const rank = await this.calculateRank(
                    blockchain,
                    serviceAgreement.keyword,
                    serviceAgreement.hashFunctionId,
                    r2,
                );

                updateServiceAgreementsLastCommitEpoch.push(
                    this.repositoryModuleManager.updateServiceAgreementLastCommitEpoch(
                        serviceAgreement.agreementId,
                        serviceAgreement.currentEpoch,
                    ),
                );

                if (rank == null) {
                    this.logger.trace(
                        `Node not in R2: ${r2} for the Service Agreement with the ID: ${serviceAgreement.agreementId}. Skipping scheduling submitCommitCommand.`,
                    );
                    continue;
                }

                if (rank >= r0) {
                    this.logger.trace(
                        `Calculated rank: ${
                            rank + 1
                        }. Node not in R0: ${r0} for the Service Agreement with the ID: ${
                            serviceAgreement.agreementId
                        }. Skipping scheduling submitCommitCommand.`,
                    );
                    continue;
                }

                this.logger.trace(
                    `Calculated rank: ${
                        rank + 1
                    }. Node in R0: ${r0} for the Service Agreement with the ID: ${
                        serviceAgreement.agreementId
                    }. Scheduling submitCommitCommand.`,
                );

                scheduleSubmitCommitCommands.push(
                    this.scheduleSubmitCommitCommand(serviceAgreement),
                );
            } catch (error) {
                this.logger.warn(
                    `Failed to schedule submitCommitCommand for the Service Agreement with the ID: ${serviceAgreement.agreementId}. Error message: ${error.message}.`,
                );
                continue;
            }
        }
        await Promise.all([
            ...scheduleSubmitCommitCommands,
            ...updateServiceAgreementsLastCommitEpoch,
        ]);
    }

    async scheduleCalculateProofsCommands(
        blockchain,
        maxTransactions,
        proofWindowDurationPerc,
        r0,
    ) {
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

            try {
                const eligibleForReward = await this.isEligibleForRewards(
                    blockchain,
                    serviceAgreement.agreementId,
                    serviceAgreement.currentEpoch,
                    serviceAgreement.stateIndex,
                    r0,
                );
                if (eligibleForReward) {
                    this.logger.trace(
                        `Node is eligible for rewards for the Service Agreement with the ID: ${serviceAgreement.agreementId}. Scheduling submitProofsCommand.`,
                    );

                    scheduleSubmitProofCommands.push(
                        this.scheduleSubmitProofsCommand(serviceAgreement),
                    );
                } else {
                    this.logger.trace(
                        `Node is not eligible for rewards for the Service Agreement with the ID: ${serviceAgreement.agreementId}. Skipping scheduling submitProofsCommand.`,
                    );
                }
                updateServiceAgreementsLastProofEpoch.push(
                    this.repositoryModuleManager.updateServiceAgreementLastProofEpoch(
                        serviceAgreement.agreementId,
                        serviceAgreement.currentEpoch,
                    ),
                );
            } catch (error) {
                this.logger.warn(
                    `Failed to schedule submitProofsCommand for the Service Agreement with the ID: ${serviceAgreement.agreementId}. Error message: ${error.message}.`,
                );
                continue;
            }
        }
        await Promise.all([
            ...scheduleSubmitProofCommands,
            ...updateServiceAgreementsLastProofEpoch,
        ]);
    }

    async calculateRank(blockchain, keyword, hashFunctionId, r2) {
        const neighbourhood = await this.shardingTableService.findNeighbourhood(
            blockchain,
            keyword,
            r2,
            hashFunctionId,
            true,
        );

        const peerId = this.networkModuleManager.getPeerId().toB58String();
        if (!neighbourhood.some((node) => node.peerId === peerId)) {
            return;
        }

        const scores = await Promise.all(
            neighbourhood.map(async (node) => ({
                score: await this.serviceAgreementService.calculateScore(
                    node.peerId,
                    blockchain,
                    keyword,
                    hashFunctionId,
                ),
                peerId: node.peerId,
            })),
        );

        scores.sort((a, b) => b.score - a.score);

        return scores.findIndex((node) => node.peerId === peerId);
    }

    async isEligibleForRewards(blockchain, agreementId, epoch, stateIndex, r0) {
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
            operationId: this.operationIdService.generateId(),
            blockchain: agreement.blockchainId,
            contract: agreement.assetStorageContractAddress,
            tokenId: agreement.tokenId,
            keyword: agreement.keyword,
            hashFunctionId: agreement.hashFunctionId,
            epoch: agreement.currentEpoch,
            agreementId: agreement.agreementId,
            stateIndex: agreement.stateIndex,
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
            operationId: this.operationIdService.generateId(),
            blockchain: agreement.blockchainId,
            contract: agreement.assetStorageContractAddress,
            tokenId: agreement.tokenId,
            keyword: agreement.keyword,
            hashFunctionId: agreement.hashFunctionId,
            epoch: agreement.currentEpoch,
            agreementId: agreement.agreementId,
            assertionId: agreement.assertionId,
            stateIndex: agreement.stateIndex,
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
    async recover(command) {
        this.logger.warn(`Failed to execute ${command.name}. Error: ${command.message}`);

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
