import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    COMMAND_RETRIES,
    COMMAND_TX_GAS_INCREASE_FACTORS,
    TRIPLE_STORE_REPOSITORIES,
} from '../../../constants/constants.js';
import Command from '../../command.js';
import SendTransactionCommand from '../../common/send-transaction-command.js';

class SubmitProofsCommand extends SendTransactionCommand {
    constructor(ctx) {
        super(ctx);

        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.validationModuleManager = ctx.validationModuleManager;
        this.tripleStoreService = ctx.tripleStoreService;
        this.operationIdService = ctx.operationIdService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.errorType = ERROR_TYPE.COMMIT_PROOF.SUBMIT_PROOFS_ERROR;

        this.txStartStatus = OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_PROOFS_SEND_TX_START;
        this.txEndStatus = OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_PROOFS_SEND_TX_END;
        this.txErrorType = ERROR_TYPE.COMMIT_PROOF.SUBMIT_PROOFS_SEND_TX_ERROR;
        this.txGasIncreaseFactor = COMMAND_TX_GAS_INCREASE_FACTORS.SUBMIT_PROOFS;
        this.operationEndStatus = OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_PROOFS_END;
        this.commandRetryNumber = COMMAND_RETRIES.SUBMIT_PROOFS;
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
                blockchain,
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

            await this.handleError(operationId, blockchain, errorMessage, this.errorType, true);

            return Command.empty();
        }

        const { leaf, proof } = await this.validationModuleManager.getMerkleProof(
            assertion,
            Number(challenge),
        );

        if (command.retries === COMMAND_RETRIES.SUBMIT_PROOFS) {
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.COMMIT_PROOF.CALCULATE_PROOFS_END,
                operationId,
                blockchain,
                agreementId,
                epoch,
            );

            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_PROOFS_START,
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
                `Knowledge Asset was updated, not sending Proof for the Service Agreement with the ID: ${agreementId}, ` +
                    `Blockchain: ${blockchain}, Contract: ${contract}, Token ID: ${tokenId}, ` +
                    `Keyword: ${keyword}, Hash function ID: ${hashFunctionId}, Epoch: ${epoch}, ` +
                    `State Index: ${stateIndex}, Operation ID: ${operationId}`,
            );

            return Command.empty();
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

            return Command.empty();
        }

        const txGasPrice = gasPrice ?? (await this.blockchainModuleManager.getGasPrice(blockchain));

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
                        reject(result.error);
                    }

                    resolve(true);
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
                contract,
                tokenId,
                keyword,
                hashFunctionId,
                stateIndex,
                txGasPrice,
            },
            command,
        );
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

    async insufficientFundsErrorReceived(commandData) {
        await this.repositoryModuleManager.updateServiceAgreementLastProofEpoch(
            commandData.agreementId,
            commandData.epoch - 1 < 0 ? null : commandData.epoch - 1,
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
