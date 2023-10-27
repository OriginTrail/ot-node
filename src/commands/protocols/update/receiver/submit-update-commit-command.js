import Command from '../../../command.js';
import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    COMMAND_RETRIES,
} from '../../../../constants/constants.js';

class SubmitUpdateCommitCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.operationIdService = ctx.operationIdService;

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

        this.logger.trace(
            `Started the command the for the Blockchain: ${blockchain}, ` +
                `Contract: ${contract}, Token ID: ${tokenId}, Agreement ID: ${agreementId}, ` +
                `Keyword: ${keyword}, Hash Function ID: ${hashFunctionId}. ` +
                `Retry number: ${COMMAND_RETRIES.SUBMIT_UPDATE_COMMIT - command.retries + 1}.`,
            command,
        );

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

        const hasPendingUpdate = await this.blockchainModuleManager.hasPendingUpdate(
            blockchain,
            tokenId,
        );

        if (!hasPendingUpdate) {
            this.logger.trace(`Not submitting as state is already finalized for update.`, command);
            return Command.empty();
        }

        this.blockchainModuleManager.submitUpdateCommit(
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
            async (result) => {
                if (!result.error) {
                    this.operationIdService.emitChangeEvent(
                        OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_UPDATE_COMMIT_END,
                        operationId,
                        agreementId,
                        epoch,
                    );
                    this.logger.info('Successfully executed submit update commit', command);
                } else if (command.retries - 1 === 0) {
                    const errorMessage = `Failed executing submit update commit command, maximum number of retries reached. Error: ${result.error.message}`;
                    this.logger.error(errorMessage, command);
                    this.operationIdService.emitChangeEvent(
                        OPERATION_ID_STATUS.FAILED,
                        operationId,
                        errorMessage,
                        this.errorType,
                        epoch,
                    );
                } else {
                    const blockTime = this.blockchainModuleManager.getBlockTimeMillis(blockchain);
                    this.logger.warn(
                        `Failed executing submit update commit command, retrying in ${blockTime}ms. Error: ${result.error.message}`,
                        command,
                    );
                    await this.commandExecutor.add({
                        name: 'submitUpdateCommitCommand',
                        delay: blockTime,
                        retries: command.retries - 1,
                        data: command.data,
                        transactional: false,
                    });
                }
            },
        );

        const transactionQueueLength =
            this.blockchainModuleManager.getTransactionQueueLength(blockchain);

        this.logger.trace(
            `Scheduled submitUpdateCommitCommand for the Blockchain: ${blockchain}, ` +
                `Contract: ${contract}, Token ID: ${tokenId}, Agreement ID: ${agreementId}, ` +
                `Keyword: ${keyword}, Hash Function ID: ${hashFunctionId}, Operation ID ${operationId}. ` +
                `Transaction Queue Length: ${transactionQueueLength}.`,
            command,
        );

        return Command.empty();
    }

    async calculateCurrentEpoch(startTime, epochLength, blockchain) {
        const now = await this.blockchainModuleManager.getBlockchainTimestamp(blockchain);
        return Math.floor((Number(now) - Number(startTime)) / Number(epochLength));
    }

    async retryFinished(command) {
        this.recover(command, `Max retry count for the command has been reached!`);
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
