import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    COMMAND_RETRIES,
    COMMAND_TX_GAS_INCREASE_FACTORS,
} from '../../../constants/constants.js';
import Command from '../../command.js';

class SubmitCommitCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.operationIdService = ctx.operationIdService;

        this.errorType = ERROR_TYPE.COMMIT_PROOF.SUBMIT_COMMIT_ERROR;
    }

    async execute(command) {
        const {
            operationId,
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
            agreementId,
            stateIndex,
            gasPrice,
            closestNode,
            leftNeighborhoodEdge,
            rightNeighborhoodEdge,
        } = command.data;

        this.logger.trace(
            `Started ${command.name} for the Service Agreement with the ID: ${agreementId}, ` +
                `Blockchain: ${blockchain}, Contract: ${contract}, Token ID: ${tokenId}, ` +
                `Keyword: ${keyword}, Hash function ID: ${hashFunctionId}, Epoch: ${epoch}, ` +
                `State Index: ${stateIndex}, Operation ID: ${operationId}, ` +
                `Clossest Node: ${closestNode}, Left neighborhood edge: ${leftNeighborhoodEdge}, ` +
                `Right neighborhood edge: ${rightNeighborhoodEdge}, ` +
                `Retry number: ${COMMAND_RETRIES.SUBMIT_COMMIT - command.retries + 1}`,
        );

        if (command.retries === COMMAND_RETRIES.SUBMIT_COMMIT) {
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_COMMIT_START,
                operationId,
                blockchain,
                agreementId,
                epoch,
            );
        }

        const assertionIds = await this.blockchainModuleManager.getAssertionIds(
            blockchain,
            contract,
            tokenId,
        );

        // If update for new state is already finalized (and node haven't processed the event yet), don't send commit for the older state
        if (stateIndex < assertionIds.length - 1) {
            this.logger.trace(
                `Knowledge Asset was updated, not sending Commit for the Service Agreement with the ID: ${agreementId}, ` +
                    `Blockchain: ${blockchain}, Contract: ${contract}, Token ID: ${tokenId}, ` +
                    `Keyword: ${keyword}, Hash function ID: ${hashFunctionId}, Epoch: ${epoch}, ` +
                    `State Index: ${stateIndex}, Operation ID: ${operationId}` +
                    `Clossest Node: ${closestNode}, Left neighborhood edge: ${leftNeighborhoodEdge}, ` +
                    `Right neighborhood edge: ${rightNeighborhoodEdge}`,
            );

            return Command.empty();
        }

        // this can happen in case node has already submitted update commit
        const alreadySubmitted = await this.commitAlreadySubmitted(
            blockchain,
            agreementId,
            epoch,
            stateIndex,
        );
        if (alreadySubmitted) {
            this.logger.trace(
                `Commit has already been submitted for the Service Agreement with the ID: ${agreementId}, ` +
                    `Blockchain: ${blockchain}, Contract: ${contract}, Token ID: ${tokenId}, ` +
                    `Keyword: ${keyword}, Hash function ID: ${hashFunctionId}, Epoch: ${epoch}, ` +
                    `State Index: ${stateIndex}, Operation ID: ${operationId}` +
                    `Clossest Node: ${closestNode}, Left neighborhood edge: ${leftNeighborhoodEdge}, ` +
                    `Right neighborhood edge: ${rightNeighborhoodEdge}`,
            );

            return Command.empty();
        }

        const txGasPrice = gasPrice ?? (await this.blockchainModuleManager.getGasPrice(blockchain));

        const transactionCompletePromise = new Promise((resolve, reject) => {
            this.blockchainModuleManager.submitCommit(
                blockchain,
                contract,
                tokenId,
                keyword,
                hashFunctionId,
                closestNode,
                leftNeighborhoodEdge,
                rightNeighborhoodEdge,
                epoch,
                stateIndex,
                (result) => {
                    if (result?.error) {
                        if (result.error.message.includes('NodeAlreadySubmittedCommit')) {
                            resolve(false);
                        } else {
                            reject(result.error);
                        }
                    }

                    resolve(true);
                },
                txGasPrice,
            );
        });

        const sendSubmitCommitTransactionOperationId = this.operationIdService.generateId();
        let txSuccess;
        try {
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_COMMIT_SEND_TX_START,
                sendSubmitCommitTransactionOperationId,
                blockchain,
                agreementId,
                epoch,
                operationId,
            );
            txSuccess = await transactionCompletePromise;
        } catch (error) {
            this.logger.warn(
                `Failed to execute ${command.name}, Error Message: ${error.message} for the Service Agreement ` +
                    `with the ID: ${agreementId}, Blockchain: ${blockchain}, Contract: ${contract}, ` +
                    `Token ID: ${tokenId}, Keyword: ${keyword}, Hash function ID: ${hashFunctionId}, ` +
                    `Epoch: ${epoch}, State Index: ${stateIndex}, Operation ID: ${operationId}, ` +
                    `Clossest Node: ${closestNode}, Left neighborhood edge: ${leftNeighborhoodEdge}, ` +
                    `Right neighborhood edge: ${rightNeighborhoodEdge}, ` +
                    `Retry number: ${COMMAND_RETRIES.SUBMIT_COMMIT - command.retries + 1}.`,
            );
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.FAILED,
                sendSubmitCommitTransactionOperationId,
                blockchain,
                error.message,
                ERROR_TYPE.COMMIT_PROOF.SUBMIT_COMMIT_SEND_TX_ERROR,
            );
            let newGasPrice;
            if (
                error.message.includes(`timeout exceeded`) ||
                error.message.includes(`Pool(TooLowPriority`)
            ) {
                newGasPrice = Math.ceil(txGasPrice * COMMAND_TX_GAS_INCREASE_FACTORS.SUBMIT_COMMIT);
            } else {
                newGasPrice = null;
            }

            Object.assign(command, {
                data: { ...command.data, gasPrice: newGasPrice },
                message: error.message,
            });

            return Command.retry();
        }

        let msgBase;
        if (txSuccess) {
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_COMMIT_SEND_TX_END,
                sendSubmitCommitTransactionOperationId,
                blockchain,
                agreementId,
                epoch,
                operationId,
            );
            msgBase = 'Successfully executed';

            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_COMMIT_END,
                operationId,
                blockchain,
                agreementId,
                epoch,
            );
        } else {
            msgBase = 'Node has already submitted commit. Finishing';
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.FAILED,
                sendSubmitCommitTransactionOperationId,
                blockchain,
                msgBase,
                ERROR_TYPE.COMMIT_PROOF.SUBMIT_COMMIT_SEND_TX_ERROR,
            );
        }

        this.logger.trace(
            `${msgBase} ${command.name} for the Service Agreement with the ID: ${agreementId}, ` +
                `Blockchain: ${blockchain}, Contract: ${contract}, Token ID: ${tokenId}, ` +
                `Keyword: ${keyword}, Hash function ID: ${hashFunctionId}, Epoch: ${epoch}, ` +
                `State Index: ${stateIndex}, Operation ID: ${operationId}, ` +
                `Clossest Node: ${closestNode}, Left neighborhood edge: ${leftNeighborhoodEdge}, ` +
                `Right neighborhood edge: ${rightNeighborhoodEdge}, ` +
                `Retry number: ${COMMAND_RETRIES.SUBMIT_COMMIT - command.retries + 1}`,
        );

        return Command.empty();
    }

    async commitAlreadySubmitted(blockchain, agreementId, epoch, stateIndex) {
        const commits = await this.blockchainModuleManager.getTopCommitSubmissions(
            blockchain,
            agreementId,
            epoch,
            stateIndex,
        );
        const identityId = await this.blockchainModuleManager.getIdentityId(blockchain);

        for (const commit of commits) {
            if (Number(commit.identityId) === identityId) {
                return true;
            }
        }

        return false;
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
     * Builds default handleStoreInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'submitCommitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default SubmitCommitCommand;
