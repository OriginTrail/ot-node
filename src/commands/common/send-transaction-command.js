import Command from '../command.js';
import { EXPECTED_TRANSACTION_ERRORS, OPERATION_ID_STATUS } from '../../constants/constants.js';

class SendTransactionCommand extends Command {
    async sendTransactionAndHandleResult(transactionCompletePromise, data, command) {
        const {
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
            stateIndex,
            txGasPrice,
        } = data;
        const sendTransactionOperationId = this.operationIdService.generateId();
        let txSuccess;
        let msgBase;
        try {
            this.operationIdService.emitChangeEvent(
                this.txStartStatus,
                sendTransactionOperationId,
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
                    `Token ID: ${tokenId}, Keyword: ${keyword} ` +
                    `Epoch: ${epoch}, State Index: ${stateIndex}, Operation ID: ${operationId}, ` +
                    `Closest Node: ${closestNode}, Left neighborhood edge: ${leftNeighborhoodEdge}, ` +
                    `Right neighborhood edge: ${rightNeighborhoodEdge}, ` +
                    `Retry number: ${this.commandRetryNumber - command.retries + 1}.`,
            );
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.FAILED,
                sendTransactionOperationId,
                blockchain,
                error.message,
                this.txErrorType,
            );
            txSuccess = false;
            if (error.message.includes(EXPECTED_TRANSACTION_ERRORS.NODE_ALREADY_SUBMITTED_COMMIT)) {
                msgBase = 'Node has already submitted commit. Finishing';
            } else if (error.message.includes(EXPECTED_TRANSACTION_ERRORS.NODE_ALREADY_REWARDED)) {
                msgBase = 'Node already rewarded. Finishing';
            } else if (
                error.message.includes(EXPECTED_TRANSACTION_ERRORS.SERVICE_AGREEMENT_DOESNT_EXIST)
            ) {
                msgBase = 'Service agreement doesnt exist. Finishing';
            } else if (
                error.message.includes(
                    EXPECTED_TRANSACTION_ERRORS.INVALID_PROXIMITY_SCORE_FUNCTIONS_PAIR_ID,
                )
            ) {
                msgBase = 'Invalid proximity score functions pair id. Finishing';
            } else if (
                error.message.includes(EXPECTED_TRANSACTION_ERRORS.INVALID_SCORE_FUNCTION_ID)
            ) {
                msgBase = 'Invalid score function id. Finishing';
            } else if (error.message.includes(EXPECTED_TRANSACTION_ERRORS.COMMIT_WINDOW_CLOSED)) {
                msgBase = 'Commit window closed. Finishing';
            } else if (
                error.message.includes(EXPECTED_TRANSACTION_ERRORS.NODE_NOT_IN_SHARDING_TABLE)
            ) {
                msgBase = 'Node not in sharding table. Finishing';
            } else if (error.message.includes(EXPECTED_TRANSACTION_ERRORS.PROOF_WINDOW_CLOSED)) {
                msgBase = 'Proof window closed. Finishing';
            } else if (error.message.includes(EXPECTED_TRANSACTION_ERRORS.NODE_NOT_AWARDED)) {
                msgBase = 'Node not awarded. Finishing';
            } else if (error.message.includes(EXPECTED_TRANSACTION_ERRORS.WRONG_MERKLE_PROOF)) {
                msgBase = 'Wrong merkle proof. Finishing';
            } else if (error.message.includes(EXPECTED_TRANSACTION_ERRORS.INSUFFICIENT_FUNDS)) {
                msgBase = 'Insufficient funds. Finishing';
                if (this.insufficientFundsErrorReceived) {
                    await this.insufficientFundsErrorReceived(command.data);
                }
            } else {
                let newGasPrice;
                if (
                    error.message.includes(EXPECTED_TRANSACTION_ERRORS.TIMEOUT_EXCEEDED) ||
                    error.message.includes(EXPECTED_TRANSACTION_ERRORS.TOO_LOW_PRIORITY)
                ) {
                    newGasPrice = Math.ceil(txGasPrice * this.txGasIncreaseFactor);
                } else {
                    newGasPrice = null;
                }

                Object.assign(command, {
                    data: { ...command.data, gasPrice: newGasPrice },
                    message: error.message,
                });

                return Command.retry();
            }
        }

        if (txSuccess) {
            this.operationIdService.emitChangeEvent(
                this.txEndStatus,
                sendTransactionOperationId,
                blockchain,
                agreementId,
                epoch,
                operationId,
            );
            msgBase = 'Successfully executed';

            this.operationIdService.emitChangeEvent(
                this.operationEndStatus,
                operationId,
                blockchain,
                agreementId,
                epoch,
            );
        }

        this.logger.trace(
            `${msgBase} ${command.name} for the Service Agreement with the ID: ${agreementId}, ` +
                `Blockchain: ${blockchain}, Contract: ${contract}, Token ID: ${tokenId}, ` +
                `Keyword: ${keyword}, Epoch: ${epoch}, ` +
                `State Index: ${stateIndex}, Operation ID: ${operationId}, ` +
                `Closest Node: ${closestNode}, Left neighborhood edge: ${leftNeighborhoodEdge}, ` +
                `Right neighborhood edge: ${rightNeighborhoodEdge}, ` +
                `Retry number: ${this.commandRetryNumber - command.retries + 1}`,
        );

        return Command.empty();
    }

    /**
     * Builds default sendTransactionCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'sendTransactionCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default SendTransactionCommand;
