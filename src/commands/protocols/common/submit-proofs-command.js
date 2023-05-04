import { v4 as uuidv4 } from 'uuid';
import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    COMMAND_RETRIES,
    BLOCK_TIME,
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

        this.errorType = ERROR_TYPE.COMMIT_PROOF.SUBMIT_PROOFS_ERROR;
    }

    async execute(command) {
        const {
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

        // TODO: review operationId
        const operationId = uuidv4();

        this.logger.trace(
            `Started ${command.name} for agreement id: ${agreementId} ` +
                `contract: ${contract}, token id: ${tokenId}, keyword: ${keyword}, ` +
                `hash function id: ${hashFunctionId}, stateIndex: ${stateIndex}. Retry number ${
                    COMMAND_RETRIES.SUBMIT_PROOFS - command.retries + 1
                }`,
        );

        if (command.retries === COMMAND_RETRIES.SUBMIT_PROOFS) {
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.COMMIT_PROOF.CALCULATE_PROOFS_START,
                operationId,
                agreementId,
                epoch,
            );
        }

        this.logger.trace(`Calculating proofs for agreement id : ${agreementId}`);
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
            this.logger.trace(`Assertion with id: ${assertionId} not found in triple store.`);
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
        } else {
            const alreadySubmitted = await this.proofAlreadySubmitted(
                blockchain,
                agreementId,
                epoch,
                stateIndex,
            );
            if (alreadySubmitted) {
                this.logger.trace(
                    `Proofs already submitted for blockchain: ${blockchain} agreement id: ${agreementId}, epoch: ${epoch}, state index: ${stateIndex}`,
                );
                return Command.empty();
            }
        }

        await this.blockchainModuleManager.sendProof(
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
            proof,
            leaf,
            stateIndex,
            async (result) => {
                if (!result.error) {
                    this.logger.trace(
                        `Successfully executed ${command.name} for agreement id: ${agreementId} ` +
                            `contract: ${contract}, token id: ${tokenId}, keyword: ${keyword}, ` +
                            `hash function id: ${hashFunctionId}. Retry number ${
                                COMMAND_RETRIES.SUBMIT_PROOFS - command.retries + 1
                            }`,
                    );

                    this.operationIdService.emitChangeEvent(
                        OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_PROOFS_END,
                        operationId,
                        agreementId,
                        epoch,
                    );
                } else if (command.retries - 1 === 0) {
                    const errorMessage = `Failed executing submit proofs command, maximum number of retries reached. Error: ${result.error.message}. Scheduling next epoch check.`;
                    this.logger.error(errorMessage);
                    this.operationIdService.emitChangeEvent(
                        OPERATION_ID_STATUS.FAILED,
                        operationId,
                        errorMessage,
                        this.errorType,
                        epoch,
                    );
                } else {
                    const commandDelay = BLOCK_TIME * 1000; // one block
                    this.logger.warn(
                        `Failed executing submit proofs command, retrying in ${commandDelay}ms. Error: ${result.error.message}`,
                    );
                    await this.commandExecutor.add({
                        name: 'submitProofsCommand',
                        sequence: [],
                        delay: commandDelay,
                        data: command.data,
                        retries: command.retries - 1,
                        transactional: false,
                    });
                }
            },
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
