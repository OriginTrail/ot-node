/* eslint-disable no-await-in-loop */
import Command from '../../command.js';
import {
    COMMAND_QUEUE_PARALLELISM,
    COMMAND_RETRIES,
    TRANSACTION_CONFIRMATIONS,
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    TRIPLE_STORE_REPOSITORIES,
    SERVICE_AGREEMENT_START_TIME_DELAY_FOR_COMMITS_SECONDS,
} from '../../../constants/constants.js';

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
        this.proximityScoringService = ctx.proximityScoringService;
        this.hashingService = ctx.hashingService;
        this.tripleStoreService = ctx.tripleStoreService;

        this.errorType = ERROR_TYPE.COMMIT_PROOF.EPOCH_CHECK_ERROR;
    }

    async execute(command) {
        this.logger.info('Epoch check: Starting epoch check command');
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
                    this.blockchainModuleManager.getTotalTransactionQueueLength(blockchain);
                if (transactionQueueLength >= totalTransactions) return;

                totalTransactions -= transactionQueueLength;

                const [r0, r2, totalNodesNumber, minStake, maxStake] = await Promise.all([
                    this.blockchainModuleManager.getR0(blockchain),
                    this.blockchainModuleManager.getR2(blockchain),
                    this.repositoryModuleManager.getPeersCount(blockchain),
                    this.blockchainModuleManager.getMinimumStake(blockchain),
                    this.blockchainModuleManager.getMaximumStake(blockchain),
                ]);

                await Promise.all([
                    this.scheduleSubmitCommitCommands(
                        blockchain,
                        Math.floor(totalTransactions / 2),
                        commitWindowDurationPerc,
                        r0,
                        r2,
                        totalNodesNumber,
                        minStake,
                        maxStake,
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
        totalNodesNumber,
        minStake,
        maxStake,
    ) {
        const peerRecord = await this.repositoryModuleManager.getPeerRecord(
            this.networkModuleManager.getPeerId().toB58String(),
            blockchain,
        );

        const ask = this.blockchainModuleManager.convertToWei(blockchain, peerRecord.ask);

        const timestamp = await this.blockchainModuleManager.getBlockchainTimestamp(blockchain);
        const eligibleAgreementForSubmitCommit =
            await this.repositoryModuleManager.getEligibleAgreementsForSubmitCommit(
                timestamp,
                blockchain,
                commitWindowDurationPerc,
                SERVICE_AGREEMENT_START_TIME_DELAY_FOR_COMMITS_SECONDS,
            );
        this.logger.info(
            `Epoch check: Found ${eligibleAgreementForSubmitCommit.length} eligible agreements for submit commit for blockchain: ${blockchain}`,
        );
        const scheduleSubmitCommitCommands = [];
        const updateServiceAgreementsLastCommitEpoch = [];
        for (const serviceAgreement of eligibleAgreementForSubmitCommit) {
            if (scheduleSubmitCommitCommands.length >= maxTransactions) {
                this.logger.warn(
                    `Epoch check: not scheduling new commits. Submit commit command length: ${scheduleSubmitCommitCommands.length}, max number of transactions: ${maxTransactions} for blockchain: ${blockchain}`,
                );
                break;
            }

            const neighbourhood = await this.shardingTableService.findNeighbourhood(
                blockchain,
                serviceAgreement.keyword,
                r2,
                serviceAgreement.hashFunctionId,
                serviceAgreement.scoreFunctionId,
            );

            let neighbourhoodEdges = null;
            if (serviceAgreement.scoreFunctionId === 2) {
                neighbourhoodEdges = await this.shardingTableService.getNeighboorhoodEdgeNodes(
                    neighbourhood,
                    blockchain,
                    serviceAgreement.hashFunctionId,
                    serviceAgreement.scoreFunctionId,
                    serviceAgreement.keyword,
                );
            }

            if (!neighbourhoodEdges && serviceAgreement.scoreFunctionId === 2) {
                this.logger.warn(
                    `Epoch check: unable to find neighbourhood edges for agreement id: ${serviceAgreement.agreementId} for blockchain: ${blockchain}`,
                );
                continue;
            }

            try {
                const rank = await this.serviceAgreementService.calculateRank(
                    blockchain,
                    serviceAgreement.keyword,
                    serviceAgreement.hashFunctionId,
                    serviceAgreement.scoreFunctionId,
                    r2,
                    neighbourhood,
                    neighbourhoodEdges,
                    totalNodesNumber,
                    minStake,
                    maxStake,
                );

                updateServiceAgreementsLastCommitEpoch.push(
                    this.repositoryModuleManager.updateServiceAgreementLastCommitEpoch(
                        serviceAgreement.agreementId,
                        serviceAgreement.currentEpoch,
                    ),
                );

                if (rank == null) {
                    this.logger.trace(
                        `Epoch check: Node not in R2: ${r2} for the Service Agreement with the ID: ${serviceAgreement.agreementId}. Skipping scheduling submitCommitCommand for blockchain: ${blockchain}`,
                    );
                    continue;
                }

                if (rank >= r0) {
                    this.logger.trace(
                        `Epoch check: Calculated rank: ${
                            rank + 1
                        }. Node not in R0: ${r0} for the Service Agreement with the ID: ${
                            serviceAgreement.agreementId
                        }. Skipping scheduling submitCommitCommand for blockchain: ${blockchain}`,
                    );
                    continue;
                }

                // If proof was ever sent = data is present in the Triple Store
                let isAssetSynced = Boolean(serviceAgreement.lastProofEpoch);
                if (!isAssetSynced) {
                    // Else: check Public Current Repository
                    isAssetSynced = await this.tripleStoreService.assertionExists(
                        TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                        serviceAgreement.assertionId,
                    );
                }

                // If data is not in the Triple Store, check if ask satisfied
                if (!isAssetSynced) {
                    const agreementData = await this.blockchainModuleManager.getAgreementData(
                        blockchain,
                        serviceAgreement.agreementId,
                    );
                    const blockchainAssertionSize =
                        await this.blockchainModuleManager.getAssertionSize(
                            blockchain,
                            serviceAgreement.assertionId,
                        );

                    const serviceAgreementBid = await this.serviceAgreementService.calculateBid(
                        blockchain,
                        blockchainAssertionSize,
                        agreementData,
                        r0,
                    );

                    if (serviceAgreementBid.lt(ask)) {
                        this.logger.trace(
                            `Epoch check: Ask (${ask.toString()} wei) isn't satisfied by the bid (${serviceAgreementBid.toString()} wei) for the Service Agreement with the ID: ${
                                serviceAgreement.agreementId
                            }. Skipping scheduling submitCommitCommand for blockchain: ${blockchain}`,
                        );
                        continue;
                    }
                }

                this.logger.trace(
                    `Epoch check: Calculated rank: ${
                        rank + 1
                    }. Node in R0: ${r0} for the Service Agreement with the ID: ${
                        serviceAgreement.agreementId
                    }. Scheduling submitCommitCommand for blockchain: ${blockchain}`,
                );
                const closestNode = neighbourhood[0];
                scheduleSubmitCommitCommands.push(
                    this.scheduleSubmitCommitCommand(
                        serviceAgreement,
                        neighbourhoodEdges,
                        closestNode,
                        isAssetSynced,
                    ),
                );
            } catch (error) {
                this.logger.warn(
                    `Epoch check: Failed to schedule submitCommitCommand for the Service Agreement with the ID: ${serviceAgreement.agreementId} for blockchain: ${blockchain}. Error message: ${error.message}.`,
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
        this.logger.info(
            `Epoch check: Found ${eligibleAgreementsForSubmitProofs.length} eligible agreements for submit proof for blockchain: ${blockchain}`,
        );
        const scheduleSubmitProofCommands = [];
        const updateServiceAgreementsLastProofEpoch = [];
        for (const serviceAgreement of eligibleAgreementsForSubmitProofs) {
            if (scheduleSubmitProofCommands.length >= maxTransactions) {
                this.logger.warn(
                    `Epoch check: not scheduling new proofs. Submit proofs command length: ${scheduleSubmitProofCommands.length}, max number of transactions: ${maxTransactions} for blockchain: ${blockchain}`,
                );
                break;
            }

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
                        `Epoch check: Node is eligible for rewards for the Service Agreement with the ID: ${serviceAgreement.agreementId} for blockchain: ${blockchain}. Scheduling submitProofsCommand.`,
                    );

                    scheduleSubmitProofCommands.push(
                        this.scheduleSubmitProofsCommand(serviceAgreement),
                    );
                } else {
                    this.logger.trace(
                        `Epoch check: Node is not eligible for rewards for the Service Agreement with the ID: ${serviceAgreement.agreementId}. Skipping scheduling submitProofsCommand for blockchain: ${blockchain}`,
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
                    `Epoch check: Failed to schedule submitProofsCommand for the Service Agreement with the ID: ${serviceAgreement.agreementId} for blockchain: ${blockchain}. Error message: ${error.message}.`,
                );
                continue;
            }
        }
        await Promise.all([
            ...scheduleSubmitProofCommands,
            ...updateServiceAgreementsLastProofEpoch,
        ]);
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

    async scheduleSubmitCommitCommand(agreement, neighbourhoodEdges, closestNode, isAssetSynced) {
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
            closestNode: closestNode.index,
            leftNeighborhoodEdge: neighbourhoodEdges?.leftEdge.index,
            rightNeighborhoodEdge: neighbourhoodEdges?.rightEdge.index,
        };

        if (isAssetSynced) {
            await this.commandExecutor.add({
                name: 'submitCommitCommand',
                sequence: [],
                retries: COMMAND_RETRIES.SUBMIT_COMMIT,
                data: commandData,
                transactional: false,
            });
        } else {
            await this.commandExecutor.add({
                name: 'simpleAssetSyncCommand',
                sequence: ['submitCommitCommand'],
                retries: COMMAND_RETRIES.SIMPLE_ASSET_SYNC,
                data: commandData,
                transactional: false,
            });
        }
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

        const numberOfWallets = this.blockchainModuleManager.getPublicKeys().length;

        return transactionsPerEpochCheck * numberOfWallets;
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
