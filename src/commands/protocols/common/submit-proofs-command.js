import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    COMMAND_RETRIES,
    COMMAND_TX_GAS_INCREASE_FACTORS,
    TRIPLE_STORE_REPOSITORIES,
} from '../../../constants/constants.js';
import Command from '../../command.js';

class SubmitProofsCommand extends Command {
    constructor(ctx) {
        super(ctx);

        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.validationModuleManager = ctx.validationModuleManager;
        this.tripleStoreService = ctx.tripleStoreService;
        this.operationIdService = ctx.operationIdService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.errorType = ERROR_TYPE.COMMIT_PROOF.SUBMIT_PROOFS_ERROR;
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
            assertionId,
            stateIndex,
            gasPrice,
        } = command.data;

        this.logger.trace(
            `Started ${command.name} for the Service Agreement with the ID: ${agreementId} ` +
                `Blockchain: ${blockchain}, Contract: ${contract}, Token ID: ${tokenId}, ` +
                `Keyword: ${keyword}, Hash function ID: ${hashFunctionId}, Epoch: ${epoch}, ` +
                `State Index: ${stateIndex}, Operation ID: ${operationId}, ` +
                `Retry number: ${COMMAND_RETRIES.SUBMIT_PROOFS - command.retries + 1}`,
        );

        if (command.retries === COMMAND_RETRIES.SUBMIT_PROOFS) {
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.COMMIT_PROOF.CALCULATE_PROOFS_START,
                operationId,
                agreementId,
                epoch,
            );
        }

        const { challenge } = await this.blockchainModuleManager.getChallenge(
            blockchain,
            contract,
            tokenId,
            epoch,
            stateIndex,
        );

        const assertion = await this.tripleStoreService.getAssertion(
            TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
            assertionId,
        );

        if (!assertion.length) {
            const errorMessage = `Assertion with id: ${assertionId} not found in the triple store.`;
            this.logger.trace(errorMessage);

            await this.handleError(operationId, errorMessage, this.errorType, true);

            return Command.empty();
        }

        const { leaf, proof } = this.validationModuleManager.getMerkleProof(
            assertion,
            Number(challenge),
        );

        if (command.retries === COMMAND_RETRIES.SUBMIT_PROOFS) {
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.COMMIT_PROOF.CALCULATE_PROOFS_END,
                operationId,
                agreementId,
                epoch,
            );

            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_PROOFS_START,
                operationId,
                agreementId,
                epoch,
            );
        }
        const alreadySubmitted = await this.proofAlreadySubmitted(
            blockchain,
            agreementId,
            epoch,
            stateIndex,
        );
        if (alreadySubmitted) {
            this.logger.trace(
                `Proof has already been submitted for the Service Agreement with the ID: ${agreementId}, ` +
                    `Blockchain: ${blockchain}, Contract: ${contract}, Token ID: ${tokenId}, ` +
                    `Keyword: ${keyword}, Hash function ID: ${hashFunctionId}, Epoch: ${epoch}, ` +
                    `State Index: ${stateIndex}, Operation ID: ${operationId}`,
            );

            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_PROOFS_END,
                operationId,
                agreementId,
                epoch,
            );

            return Command.empty();
        }

        const txGasPrice = gasPrice ?? (await this.blockchainModuleManager.getGasPrice());

        const transactionCompletePromise = new Promise((resolve, reject) => {
            this.blockchainModuleManager.sendProof(
                blockchain,
                contract,
                tokenId,
                keyword,
                hashFunctionId,
                epoch,
                proof,
                leaf,
                stateIndex,
                (result) => {
                    if (result?.error) {
                        if (result.error.message.includes('NodeAlreadyRewarded')) {
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

        let txSuccess;
        try {
            txSuccess = await transactionCompletePromise;
        } catch (error) {
            this.logger.warn(
                `Failed to execute ${command.name}, Error Message: ${error.message} for the Service Agreement ` +
                    `with the ID: ${agreementId}, Blockchain: ${blockchain}, Contract: ${contract}, ` +
                    `Token ID: ${tokenId}, Keyword: ${keyword}, Hash function ID: ${hashFunctionId}, ` +
                    `Epoch: ${epoch}, State Index: ${stateIndex}, Operation ID: ${operationId}, ` +
                    `Retry number: ${COMMAND_RETRIES.SUBMIT_PROOFS - command.retries + 1}.`,
            );

            let newGasPrice;
            if (
                error.message.includes(`timeout exceeded`) ||
                error.message.includes(`Pool(TooLowPriority`)
            ) {
                newGasPrice = Math.ceil(txGasPrice * COMMAND_TX_GAS_INCREASE_FACTORS.SUBMIT_PROOFS);
            } else {
                newGasPrice = null;
            }

            Object.assign(command.data, { gasPrice: newGasPrice });

            return Command.retry();
        }

        let msgBase;
        if (txSuccess) {
            msgBase = 'Successfully executed';
        } else {
            msgBase = 'Node has already sent proof. Finishing';
        }

        this.logger.trace(
            `${msgBase} ${command.name} for the Service Agreement with the ID: ${agreementId}, ` +
                `Blockchain: ${blockchain}, Contract: ${contract}, Token ID: ${tokenId}, ` +
                `Keyword: ${keyword}, Hash function ID: ${hashFunctionId}, Epoch: ${epoch}, ` +
                `State Index: ${stateIndex}, Operation ID: ${operationId}, ` +
                `Retry number: ${COMMAND_RETRIES.SUBMIT_PROOFS - command.retries + 1}`,
        );

        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_PROOFS_END,
            operationId,
            agreementId,
            epoch,
        );

        return Command.empty();
    }

    async proofAlreadySubmitted(blockchain, agreementId, epoch, stateIndex) {
        const commits = await this.blockchainModuleManager.getTopCommitSubmissions(
            blockchain,
            agreementId,
            epoch,
            stateIndex,
        );
        const identityId = await this.blockchainModuleManager.getIdentityId(blockchain);

        for (const commit of commits) {
            if (Number(commit.identityId) === identityId && Number(commit.score) === 0) {
                return true;
            }
        }

        return false;
    }

    async retryFinished(command) {
        this.recover(command, `Max retry count for command: ${command.name} reached!`);
    }

    /**
     * Builds default submitProofsCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'submitProofsCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default SubmitProofsCommand;
