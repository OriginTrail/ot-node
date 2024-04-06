import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';

import {
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    COMMAND_RETRIES,
    PENDING_STORAGE_REPOSITORIES,
    COMMIT_BLOCK_DURATION_IN_BLOCKS,
    COMMITS_DELAY_BETWEEN_NODES_IN_BLOCKS,
} from '../../../../../constants/constants.js';

class HandleUpdateRequestCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.updateService;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.commandExecutor = ctx.commandExecutor;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.tripleStoreService = ctx.tripleStoreService;
        this.ualService = ctx.ualService;
        this.pendingStorageService = ctx.pendingStorageService;
        this.shardingTableService = ctx.shardingTableService;
        this.hashingService = ctx.hashingService;
        this.proximityScoringService = ctx.proximityScoringService;

        this.errorType = ERROR_TYPE.UPDATE.UPDATE_LOCAL_STORE_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const {
            blockchain,
            contract,
            tokenId,
            operationId,
            agreementId,
            keyword,
            hashFunctionId,
            proximityScoreFunctionsPairId,
            agreementData,
        } = commandData;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.UPDATE.VALIDATING_UPDATE_ASSERTION_REMOTE_START,
        );

        const cachedData = await this.operationIdService.getCachedOperationIdData(operationId);
        await this.pendingStorageService.cacheAssertionData(
            PENDING_STORAGE_REPOSITORIES.PUBLIC,
            blockchain,
            contract,
            tokenId,
            cachedData.assertionId,
            {
                public: {
                    assertion: cachedData.assertion,
                },
                agreementId,
                agreementData,
            },
            operationId,
        );

        const updateCommitWindowDuration =
            await this.blockchainModuleManager.getUpdateCommitWindowDuration(blockchain);
        const r0 = await this.blockchainModuleManager.getR0(blockchain);
        const r2 = await this.blockchainModuleManager.getR2(blockchain);
        const scheduleCommandsPromises = [];

        const neighbourhood = await this.shardingTableService.findNeighbourhood(
            blockchain,
            keyword,
            r2,
            hashFunctionId,
            proximityScoreFunctionsPairId,
        );

        const closestNode = neighbourhood[0];

        let neighbourhoodEdges = null;
        if (proximityScoreFunctionsPairId === 2) {
            neighbourhoodEdges = await this.shardingTableService.getNeighboorhoodEdgeNodes(
                neighbourhood,
                blockchain,
                hashFunctionId,
                proximityScoreFunctionsPairId,
                keyword,
            );
        }

        if (!neighbourhoodEdges && proximityScoreFunctionsPairId === 2) {
            throw Error('Unable to find neighbourhood edges for asset');
        }

        const totalNodesNumber = await this.repositoryModuleManager.getPeersCount(blockchain);
        const minStake = await this.blockchainModuleManager.getMinimumStake(blockchain);
        const maxStake = await this.blockchainModuleManager.getMaximumStake(blockchain);

        const rank = await this.serviceAgreementService.calculateRank(
            blockchain,
            keyword,
            hashFunctionId,
            proximityScoreFunctionsPairId,
            r2,
            neighbourhood,
            neighbourhoodEdges,
            totalNodesNumber,
            minStake,
            maxStake,
        );
        if (rank != null) {
            this.logger.trace(`Calculated rank: ${rank + 1} for agreement id:  ${agreementId}`);
            const finalizationCommitsNumber =
                await this.blockchainModuleManager.getFinalizationCommitsNumber(blockchain);

            const updateCommitDelay = await this.calculateUpdateCommitDelay(
                blockchain,
                updateCommitWindowDuration,
                finalizationCommitsNumber,
                r0,
                rank,
            );
            scheduleCommandsPromises.push(
                this.commandExecutor.add({
                    name: 'submitUpdateCommitCommand',
                    delay: updateCommitDelay,
                    retries: COMMAND_RETRIES.SUBMIT_UPDATE_COMMIT,
                    data: {
                        ...commandData,
                        agreementData,
                        agreementId,
                        r0,
                        r2,
                        updateCommitWindowDuration,
                        proximityScoreFunctionsPairId,
                        closestNode: closestNode?.index,
                        leftNeighborhoodEdge: neighbourhoodEdges?.leftEdge?.index,
                        rightNeighborhoodEdge: neighbourhoodEdges?.rightEdge?.index,
                    },
                    transactional: false,
                }),
            );
        }

        scheduleCommandsPromises.push(
            this.commandExecutor.add({
                name: 'deletePendingStateCommand',
                sequence: [],
                delay: (updateCommitWindowDuration + 60) * 1000,
                data: {
                    ...commandData,
                    assertionId: cachedData.assertionId,
                },
                transactional: false,
            }),
        );

        await Promise.all(scheduleCommandsPromises);
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.UPDATE.VALIDATING_UPDATE_ASSERTION_REMOTE_END,
        );
        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: {} };
    }

    async calculateUpdateCommitDelay(
        blockchain,
        updateCommitWindowDuration,
        finalizationCommitsNumber,
        r0,
        rank,
    ) {
        const r0OffsetPeriod = 0;
        const blockTime = this.blockchainModuleManager.getBlockTimeMillis(blockchain);
        // wait for 5 blocks for first batch to send commits
        const commitsBlockDuration = blockTime * COMMIT_BLOCK_DURATION_IN_BLOCKS;
        const commitBlock = Math.floor(rank / finalizationCommitsNumber);
        // put 5 blocks delay between nodes if they are not in first batch
        const nextNodeDelay =
            commitBlock === 0
                ? 0
                : (rank % finalizationCommitsNumber) *
                  COMMITS_DELAY_BETWEEN_NODES_IN_BLOCKS *
                  blockTime;
        const delay = commitsBlockDuration * commitBlock + r0OffsetPeriod + nextNodeDelay;
        this.logger.info(
            `Calculated update commit delay: ${Math.floor(
                delay / 1000,
            )}s, commitsBlockDuration: ${commitsBlockDuration}, commitBlock: ${commitBlock}, r0OffsetPeriod:${r0OffsetPeriod}, updateCommitWindowDuration ${updateCommitWindowDuration}s, finalizationCommitsNumber: ${finalizationCommitsNumber}, r0: ${r0}, rank: ${rank}`,
        );

        return delay;
    }

    /**
     * Builds default HandleUpdateRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0HandleUpdateRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandleUpdateRequestCommand;
