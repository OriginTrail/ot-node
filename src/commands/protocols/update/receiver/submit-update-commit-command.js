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

        const epoch = await this.calculateCurrentEpoch(
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

        const hasPendingUpdates = await this.blockchainModuleManager.hasPendingUpdate(
            blockchain,
            tokenId,
        );
        if (hasPendingUpdates) {
            this.logger.trace(`Not submitting as state is already finalized for update.`);
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
