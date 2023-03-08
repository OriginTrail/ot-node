import EpochCommand from '../../common/epoch-command.js';
import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    COMMAND_RETRIES,
} from '../../../../constants/constants.js';

class SubmitUpdateCommitCommand extends EpochCommand {
    constructor(ctx) {
        super(ctx);
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.operationIdService = ctx.operationIdService;
        this.shardingTableService = ctx.shardingTableService;
        this.networkModuleManager = ctx.networkModuleManager;

        this.errorType = ERROR_TYPE.COMMIT_PROOF.SUBMIT_UPDATE_COMMIT_ERROR;
    }

    async execute(command) {
        const {
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            agreementData,
            agreementId,
            operationId,
        } = command.data;

        const epoch = this.calculateCurrentEpoch(
            agreementData.startTime,
            agreementData.epochLength,
            blockchain,
        );

        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_UPDATE_COMMIT_START,
            operationId,
            agreementId,
            epoch,
        );

        this.logger.trace(
            `Started ${command.name} for agreement id: ${command.data.agreementId} ` +
                `blockchain: ${blockchain} contract: ${contract}, token id: ${tokenId}, ` +
                `keyword: ${keyword}, hash function id: ${hashFunctionId}. Retry number ${
                    COMMAND_RETRIES.SUBMIT_UPDATE_COMMIT - command.retries + 1
                }`,
        );

        this.logger.trace(
            `Calculating commit submission score for agreement id: ${agreementId}...`,
        );

        const rank = await this.calculateRank(blockchain, keyword, hashFunctionId);
        const r0 = await this.blockchainModuleManager.getR0(blockchain);

        if (rank >= r0) {
            this.logger.trace(
                `Calculated rank: ${
                    rank + 1
                } higher than R0: ${r0}. Scheduling next epoch check for agreement id: ${agreementId}`,
            );
            return EpochCommand.empty();
        }

        await this.blockchainModuleManager.submitUpdateCommit(
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
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

    /**
     * Builds default submitUpdateCommitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'submitUpdateCommitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default SubmitUpdateCommitCommand;
