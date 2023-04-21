import EpochCommand from '../../common/epoch-command.js';
import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    COMMAND_RETRIES,
    BLOCK_TIME,
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
            Number(agreementData.startTime),
            Number(agreementData.epochLength),
            blockchain,
        );

        if (command.retries === COMMAND_RETRIES.SUBMIT_UPDATE_COMMIT) {
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_UPDATE_COMMIT_START,
                operationId,
                agreementId,
                epoch,
            );
        }

        this.logger.trace(
            `Started ${command.name} for agreement id: ${command.data.agreementId} ` +
                `blockchain: ${blockchain} contract: ${contract}, token id: ${tokenId}, ` +
                `keyword: ${keyword}, hash function id: ${hashFunctionId}. Retry number ${
                    COMMAND_RETRIES.SUBMIT_UPDATE_COMMIT - command.retries + 1
                }`,
        );

        const hasPendingUpdate = await this.blockchainModuleManager.hasPendingUpdate(
            blockchain,
            tokenId,
        );

        if (!hasPendingUpdate) {
            this.logger.trace(`Not submitting as state is already finalized for update.`);
            return EpochCommand.empty();
        }

        const that = this;
        await this.blockchainModuleManager.submitUpdateCommit(
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
            async (result) => {
                if (!result.error) {
                    that.operationIdService.emitChangeEvent(
                        OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_UPDATE_COMMIT_END,
                        operationId,
                        agreementId,
                        epoch,
                    );
                    that.logger.info('Successfully executed submit update commit');
                } else if (command.retries - 1 === 0) {
                    const errorMessage = `Failed executing submit update commit command, maximum number of retries reached. Error: ${result.error.message}`;
                    that.logger.error(errorMessage);
                    that.operationIdService.emitChangeEvent(
                        OPERATION_ID_STATUS.FAILED,
                        operationId,
                        errorMessage,
                        that.errorType,
                        epoch,
                    );
                } else {
                    const commandDelay = BLOCK_TIME * 1000; // one block
                    that.logger.warn(
                        `Failed executing submit update commit command, retrying in ${commandDelay}ms. Error: ${result.error.message}`,
                    );
                    that.commandExecutor.add({
                        name: 'submitUpdateCommitCommand',
                        delay: commandDelay,
                        retries: command.retries - 1,
                        data: command.data,
                        transactional: false,
                    });
                }
            },
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
