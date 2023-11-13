import Command from '../../../command.js';
import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    COMMAND_RETRIES,
    COMMAND_TX_GAS_INCREASE_FACTORS,
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
            gasPrice,
        } = command.data;

        this.logger.trace(
            `Started ${command.name} for the Service Agreement with the ID: ${agreementId}, ` +
                `Blockchain: ${blockchain}, Contract: ${contract}, Token ID: ${tokenId},` +
                `Keyword: ${keyword}, Hash function ID: ${hashFunctionId}, Operation ID: ${operationId}, ` +
                `Retry number: ${COMMAND_RETRIES.SUBMIT_UPDATE_COMMIT - command.retries + 1}`,
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
            this.logger.trace(
                `Not submitting update commit as state has been already finalized for the Service Agreement ` +
                    `with the ID: ${agreementId}, Blockchain: ${blockchain}, Contract: ${contract}, ` +
                    `Token ID: ${tokenId}, Keyword: ${keyword}, Hash function ID: ${hashFunctionId}, ` +
                    `Epoch: ${epoch}, Operation ID: ${operationId}`,
            );

            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_UPDATE_COMMIT_START,
                operationId,
                agreementId,
                epoch,
            );

            return Command.empty();
        }

        const txGasPrice = gasPrice ?? (await this.blockchainModuleManager.getGasPrice());

        const transactionCompletePromise = new Promise((resolve, reject) => {
            this.blockchainModuleManager.submitUpdateCommit(
                blockchain,
                contract,
                tokenId,
                keyword,
                hashFunctionId,
                epoch,
                (result) => {
                    if (result?.error) {
                        reject(result.error);
                    }

                    resolve();
                },
                txGasPrice,
            );
        });

        try {
            await transactionCompletePromise;
        } catch (error) {
            let newGasPrice;
            if (
                error.message.includes(`timeout exceeded`) ||
                error.message.includes(`Pool(TooLowPriority`)
            ) {
                newGasPrice = Math.ceil(
                    txGasPrice * COMMAND_TX_GAS_INCREASE_FACTORS.SUBMIT_UPDATE_COMMIT,
                );
            } else {
                newGasPrice = null;
            }

            Object.assign(command.data, { gasPrice: newGasPrice });

            return Command.retry();
        }

        this.logger.trace(
            `Successfully executed ${command.name} for the Service Agreement with the ID: ${agreementId}, ` +
                `Blockchain: ${blockchain}, Contract: ${contract}, Token ID: ${tokenId},` +
                `Keyword: ${keyword}, Hash function ID: ${hashFunctionId}, Epoch: ${epoch}, ` +
                `Operation ID: ${operationId}, Retry number: ${
                    COMMAND_RETRIES.SUBMIT_UPDATE_COMMIT - command.retries + 1
                }`,
        );

        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_UPDATE_COMMIT_END,
            operationId,
            agreementId,
            epoch,
        );

        return Command.empty();
    }

    async calculateCurrentEpoch(startTime, epochLength, blockchain) {
        const now = await this.blockchainModuleManager.getBlockchainTimestamp(blockchain);
        return Math.floor((Number(now) - Number(startTime)) / Number(epochLength));
    }

    async retryFinished(command) {
        this.recover(command, `Max retry count for command: ${command.name} reached!`);
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
