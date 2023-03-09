import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';

import {
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    COMMAND_RETRIES,
    PENDING_STORAGE_REPOSITORIES,
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
            { assertion, ...agreementData },
            operationId,
        );

        const updateCommitWindowDuration =
            await this.blockchainModuleManager.getUpdateCommitWindowDuration(blockchain);
        const R0 = await this.blockchainModuleManager.getR0(blockchain);
        const R2 = await this.blockchainModuleManager.getR2(blockchain);

        const rank = await this.calculateRank(blockchain, keyword, hashFunctionId, R2);
        this.logger.trace(
            `Calculated rank: ${rank + 1} higher than R0: ${R0} for agreement id:  ${agreementId}`,
        );

        const updateCommitDelay = await this.calculateUpdateCommitDelay(
            updateCommitWindowDuration,
            R0,
            R2,
            rank,
        );

        await Promise.all([
            this.commandExecutor.add({
                name: 'deletePendingStateCommand',
                sequence: [],
                delay: updateCommitWindowDuration * 1000,
                data: commandData,
                transactional: false,
            }),
            this.commandExecutor.add({
                name: 'submitUpdateCommitCommand',
                delay: 0,
                period: updateCommitDelay * 1000,
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

        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: {} };
    }

    async calculateUpdateCommitDelay(updateCommitWindowDuration, R0, R2, rank) {
        // TODO: move to constants
        const r0OffsetPeriod = 4; // 4 minutes for R0 nodes to commit

        if (rank < R0) {
            return 12; // After 12 seconds start commiting
        }

        /*
            TODO: Remove if not finding it useful
            Ordering of nodes:
                Node: 3 - 4 min
                Node: 4 - 6 min
                Node: 5 - 7 min
                Node: 6 - 9 min
                Node: 7 - 10 min
                Node: 8 - 12 min
                Node: 9 - 13 min
                Node: 10 - 15 min
                Node: 11 - 16 min
                Node: 12 - 18 min
                Node: 13 - 19 min
                Node: 14 - 21 min
                Node: 15 - 22 min
                Node: 16 - 24 min
                Node: 17 - 25 min
                Node: 18 - 27 min
                Node: 19 - 28 min
         */
        return Math.round(
            r0OffsetPeriod +
                ((rank - R0) * (updateCommitWindowDuration - r0OffsetPeriod)) / (R2 - R0),
        );
    }

    async calculateRank(blockchain, keyword, hashFunctionId, R2) {
        const neighbourhood = await this.shardingTableService.findNeighbourhood(
            blockchain,
            keyword,
            R2,
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
