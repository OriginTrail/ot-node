import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';

import {
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    COMMAND_RETRIES,
    PENDING_STORAGE_REPOSITORIES,
    COMMIT_BLOCK_DURATION_IN_BLOCKS,
    BLOCK_TIME,
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
            agreementData,
        } = commandData;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.UPDATE.VALIDATING_UPDATE_ASSERTION_REMOTE_START,
        );

        const { assertion } = await this.operationIdService.getCachedOperationIdData(operationId);
        await this.pendingStorageService.cacheAssertion(
            PENDING_STORAGE_REPOSITORIES.PUBLIC,
            blockchain,
            contract,
            tokenId,
            {
                public: {
                    assertion,
                },
                agreementId,
                agreementData,
            },
            operationId,
        );

        const updateCommitWindowDuration =
            await this.blockchainModuleManager.getUpdateCommitWindowDuration(blockchain);
        const R0 = await this.blockchainModuleManager.getR0(blockchain);
        const R2 = await this.blockchainModuleManager.getR2(blockchain);

        const rank = await this.calculateRank(blockchain, keyword, hashFunctionId, R2);
        this.logger.trace(`Calculated rank: ${rank + 1} for agreement id:  ${agreementId}`);
        const finalizationCommitsNumber =
            await this.blockchainModuleManager.getFinalizationCommitsNumber(blockchain);

        const updateCommitDelay = await this.calculateUpdateCommitDelay(
            updateCommitWindowDuration,
            finalizationCommitsNumber,
            R0,
            rank,
        );

        await Promise.all([
            this.commandExecutor.add({
                name: 'deletePendingStateCommand',
                sequence: [],
                delay: updateCommitWindowDuration * 1000,
                data: { ...commandData, repository: PENDING_STORAGE_REPOSITORIES.PUBLIC },
                transactional: false,
            }),
            this.commandExecutor.add({
                name: 'submitUpdateCommitCommand',
                delay: updateCommitDelay * 1000,
                retries: COMMAND_RETRIES.SUBMIT_UPDATE_COMMIT,
                data: {
                    ...commandData,
                    agreementData,
                    agreementId,
                    R0,
                    R2,
                    rank,
                    updateCommitWindowDuration,
                },
                transactional: false,
            }),
        ]);
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.UPDATE.VALIDATING_UPDATE_ASSERTION_REMOTE_END,
        );
        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: {} };
    }

    async calculateUpdateCommitDelay(
        updateCommitWindowDuration,
        finalizationCommitsNumber,
        R0,
        rank,
    ) {
        const r0OffsetPeriod = 0;
        // wait for 5 blocks for first batch to send commits
        const commitsBlockDuration = BLOCK_TIME * COMMIT_BLOCK_DURATION_IN_BLOCKS;
        const commitBlock = Math.floor(rank / finalizationCommitsNumber);
        // put 2 blocks delay between nodes if they are not in first batch
        const nextNodeDelay =
            commitBlock === 0
                ? 0
                : (rank % finalizationCommitsNumber) *
                  COMMITS_DELAY_BETWEEN_NODES_IN_BLOCKS *
                  BLOCK_TIME;
        const delay = commitsBlockDuration * commitBlock + r0OffsetPeriod + nextNodeDelay;
        this.logger.info(
            `Calculated update commit delay: ${delay}, commitsBlockDuration: ${commitsBlockDuration}, commitBlock: ${commitBlock}, r0OffsetPeriod:${r0OffsetPeriod}, updateCommitWindowDuration ${updateCommitWindowDuration}, finalizationCommitsNumber: ${finalizationCommitsNumber}, r0: ${R0}, rank: ${rank}`,
        );

        return delay;
    }

    async calculateRank(blockchain, keyword, hashFunctionId, R2) {
        const neighbourhood = await this.shardingTableService.findNeighbourhood(
            blockchain,
            keyword,
            R2,
            hashFunctionId,
            true,
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
            (node) => node.peerId === this.networkModuleManager.getPeerIdString(),
        );
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
