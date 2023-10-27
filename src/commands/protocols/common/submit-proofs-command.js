import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    COMMAND_RETRIES,
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
        } = command.data;

        this.logger.trace(
            `Started the command for the Blockchain: ${blockchain}, ` +
                `Contract: ${contract}, Token ID: ${tokenId}, Service Agreement ID: ${agreementId}, ` +
                `Keyword: ${keyword}, Hash Function ID: ${hashFunctionId}, Epoch: ${epoch}, ` +
                `State Index: ${stateIndex}, Operation ID: ${operationId}, ` +
                `Retry number: ${COMMAND_RETRIES.SUBMIT_PROOFS - command.retries + 1}.`,
            command,
        );

        if (command.retries === COMMAND_RETRIES.SUBMIT_PROOFS) {
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.COMMIT_PROOF.CALCULATE_PROOFS_START,
                operationId,
                agreementId,
                epoch,
            );
        }

        this.logger.trace(
            `Calculating proofs for the Service Agreement ID: ${agreementId}.`,
            command,
        );
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
            this.logger.trace(
                `Assertion with the ID: ${assertionId} not found in the triple store.`,
                command,
            );
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
                `Proof has been already submitted for the Blockchain: ${blockchain}, ` +
                    `Contract: ${contract}, Token ID: ${tokenId}, Service Agreement ID: ${agreementId}, ` +
                    `Keyword: ${keyword}, Hash Function ID: ${hashFunctionId}, Epoch: ${epoch}, ` +
                    `State Index: ${stateIndex}, Operation ID: ${operationId}.`,
                command,
            );
            return Command.empty();
        }

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
                    resolve();
                },
            );
        });

        await transactionCompletePromise;

        this.logger.trace(
            `Successfully executed the command for the Blockchain: ${blockchain}, ` +
                `Contract: ${contract}, Token ID: ${tokenId}, Service Agreement ID: ${agreementId}, ` +
                `Keyword: ${keyword}, Hash Function ID: ${hashFunctionId}, Epoch: ${epoch}, ` +
                `State Index: ${stateIndex}, Operation ID: ${operationId}, ` +
                `Retry number: ${COMMAND_RETRIES.SUBMIT_PROOFS - command.retries + 1}.`,
            command,
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
        this.recover(command, Error('Max retries have been exceeded!'));
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
