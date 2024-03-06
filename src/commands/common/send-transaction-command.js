import Command from '../command.js';
import { KNOWN_TRANSACTION_ERRORS, OPERATION_ID_STATUS } from '../../constants/constants.js';

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
            hashFunctionId,
            stateIndex,
            txGasPrice,
        } = data;
        const sendTransactionOperationId = this.operationIdService.generateId();
        let txSuccess;
        let msgBase;
        try {
            this.operationIdService.emitChangeEvent(
                this.TX_START,
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
                    `Token ID: ${tokenId}, Keyword: ${keyword}, Hash function ID: ${hashFunctionId}, ` +
                    `Epoch: ${epoch}, State Index: ${stateIndex}, Operation ID: ${operationId}, ` +
                    `Closest Node: ${closestNode}, Left neighborhood edge: ${leftNeighborhoodEdge}, ` +
                    `Right neighborhood edge: ${rightNeighborhoodEdge}, ` +
                    `Retry number: ${this.RETRY_NUMBER - command.retries + 1}.`,
            );
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.FAILED,
                sendTransactionOperationId,
                blockchain,
                error.message,
                this.TX_ERROR,
            );
            txSuccess = false;
            if (error.message.includes(KNOWN_TRANSACTION_ERRORS.NODE_ALREADY_SUBMITTED_COMMIT)) {
                msgBase = 'Node has already submitted commit. Finishing';
            } else if (error.message.includes(KNOWN_TRANSACTION_ERRORS.NODE_ALREADY_REWARDED)) {
                msgBase = 'Node has already sent proof. Finishing';
            } else if (error.message.includes(KNOWN_TRANSACTION_ERRORS.INSUFFICIENT_FUNDS)) {
                msgBase = 'Insufficient funds. Finishing';
                if (this.insufficientFundsErrorReceived) {
                    await this.insufficientFundsErrorReceived(command.data);
                }
            } else {
                let newGasPrice;
                if (
                    error.message.includes(KNOWN_TRANSACTION_ERRORS.TIMEOUT_EXCEEDED) ||
                    error.message.includes(KNOWN_TRANSACTION_ERRORS.TOO_LOW_PRIORITY)
                ) {
                    newGasPrice = Math.ceil(txGasPrice * this.TX_GAS_INCREASE_FACTOR);
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
                this.TX_END,
                sendTransactionOperationId,
                blockchain,
                agreementId,
                epoch,
                operationId,
            );
            msgBase = 'Successfully executed';

            this.operationIdService.emitChangeEvent(
                this.END_STATUS,
                operationId,
                blockchain,
                agreementId,
                epoch,
            );
        }

        this.logger.trace(
            `${msgBase} ${command.name} for the Service Agreement with the ID: ${agreementId}, ` +
                `Blockchain: ${blockchain}, Contract: ${contract}, Token ID: ${tokenId}, ` +
                `Keyword: ${keyword}, Hash function ID: ${hashFunctionId}, Epoch: ${epoch}, ` +
                `State Index: ${stateIndex}, Operation ID: ${operationId}, ` +
                `Closest Node: ${closestNode}, Left neighborhood edge: ${leftNeighborhoodEdge}, ` +
                `Right neighborhood edge: ${rightNeighborhoodEdge}, ` +
                `Retry number: ${this.RETRY_NUMBER - command.retries + 1}`,
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
