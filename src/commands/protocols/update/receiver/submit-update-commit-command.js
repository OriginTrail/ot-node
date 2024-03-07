import Command from '../../../command.js';
import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    COMMAND_RETRIES,
    COMMAND_TX_GAS_INCREASE_FACTORS,
    CONTRACT_FUNCTION_FIXED_GAS_PRICE,
} from '../../../../constants/constants.js';
import SendTransactionCommand from '../../../common/send-transaction-command.js';

class SubmitUpdateCommitCommand extends SendTransactionCommand {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.operationIdService = ctx.operationIdService;
        this.serviceAgreementService = ctx.serviceAgreementService;

        this.errorType = ERROR_TYPE.COMMIT_PROOF.SUBMIT_UPDATE_COMMIT_ERROR;

        this.txStartStatus = OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_UPDATE_COMMIT_SEND_TX_START;
        this.txEndStatus = OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_UPDATE_COMMIT_SEND_TX_END;
        this.txErrorType = ERROR_TYPE.COMMIT_PROOF.SUBMIT_UPDATE_COMMIT_SEND_TX_ERROR;
        this.txGasIncreaseFactor = COMMAND_TX_GAS_INCREASE_FACTORS.SUBMIT_UPDATE_COMMIT;
        this.operationEndStatus = OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_UPDATE_COMMIT_END;
        this.commandRetryNumber = COMMAND_RETRIES.SUBMIT_UPDATE_COMMIT;
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
            closestNode,
            leftNeighborhoodEdge,
            rightNeighborhoodEdge,
        } = command.data;

        this.logger.trace(
            `Started ${command.name} for the Service Agreement with the ID: ${agreementId}, ` +
                `Blockchain: ${blockchain}, Contract: ${contract}, Token ID: ${tokenId}, ` +
                `Keyword: ${keyword}, Hash function ID: ${hashFunctionId}, Operation ID: ${operationId}, ` +
                `Closest Node: ${closestNode}, Left neighborhood edge: ${leftNeighborhoodEdge}, ` +
                `Right neighborhood edge: ${rightNeighborhoodEdge}, `,
            `Retry number: ${COMMAND_RETRIES.SUBMIT_UPDATE_COMMIT - command.retries + 1}`,
        );

        const epoch = await this.serviceAgreementService.calculateCurrentEpoch(
            agreementData.startTime,
            agreementData.epochLength,
            blockchain,
        );

        if (command.retries === COMMAND_RETRIES.SUBMIT_UPDATE_COMMIT) {
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_UPDATE_COMMIT_START,
                operationId,
                blockchain,
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
                    `Closest Node: ${closestNode}, Left neighborhood edge: ${leftNeighborhoodEdge}, ` +
                    `Right neighborhood edge: ${rightNeighborhoodEdge}, `,
                +`Epoch: ${epoch}, Operation ID: ${operationId}`,
            );

            return Command.empty();
        }
        const txGasPrice =
            gasPrice ??
            CONTRACT_FUNCTION_FIXED_GAS_PRICE[blockchain]?.SUBMIT_UPDATE_COMMIT ??
            (await this.blockchainModuleManager.getGasPrice(blockchain));

        const transactionCompletePromise = new Promise((resolve, reject) => {
            this.blockchainModuleManager.submitUpdateCommit(
                blockchain,
                contract,
                tokenId,
                keyword,
                hashFunctionId,
                closestNode,
                leftNeighborhoodEdge,
                rightNeighborhoodEdge,
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

        return this.sendTransactionAndHandleResult(
            transactionCompletePromise,
            {
                blockchain,
                agreementId,
                epoch,
                operationId,
                closestNode,
                leftNeighborhoodEdge,
                rightNeighborhoodEdge,
                contract,
                tokenId,
                keyword,
                hashFunctionId,
                txGasPrice,
            },
            command,
        );
    }

    async retryFinished(command) {
        const { blockchain, operationId } = command.data;
        await this.handleError(
            operationId,
            blockchain,
            `Max retries has been reached! Latest Error Message: ${command.message}`,
            this.errorType,
            true,
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
