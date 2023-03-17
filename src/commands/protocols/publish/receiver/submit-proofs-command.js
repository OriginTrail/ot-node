import EpochCommand from '../../common/epoch-command.js';
import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    COMMAND_RETRIES,
    BLOCK_TIME,
} from '../../../../constants/constants.js';

class SubmitProofsCommand extends EpochCommand {
    constructor(ctx) {
        super(ctx);

        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.operationIdService = ctx.operationIdService;

        this.errorType = ERROR_TYPE.COMMIT_PROOF.SUBMIT_PROOFS_ERROR;
    }

    async execute(command) {
        const {
            blockchain,
            leaf,
            proof,
            agreementData,
            epoch,
            agreementId,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            operationId,
            identityId,
            assertionId,
            stateIndex,
        } = command.data;

        this.logger.trace(
            `Started ${command.name} for agreement id: ${agreementId} ` +
                `contract: ${contract}, token id: ${tokenId}, keyword: ${keyword}, ` +
                `hash function id: ${hashFunctionId}, stateIndex: ${stateIndex}. Retry number ${
                    COMMAND_RETRIES.SUBMIT_PROOFS - command.retries + 1
                }`,
        );

        const commits = await this.blockchainModuleManager.getTopCommitSubmissions(
            blockchain,
            agreementId,
            epoch,
            stateIndex,
        );
        if (this.proofAlreadySubmitted(commits, identityId)) {
            this.logger.trace(
                `Proofs already submitted for agreement id: ${agreementId} and epoch: ${epoch}`,
            );
            await this.scheduleNextEpochCheck(
                blockchain,
                agreementId,
                contract,
                tokenId,
                keyword,
                epoch,
                hashFunctionId,
                agreementData,
                operationId,
                assertionId,
            );
            return EpochCommand.empty();
        }
        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_PROOFS_START,
            operationId,
            agreementId,
            epoch,
        );
        const that = this;
        await this.blockchainModuleManager.sendProof(
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
            proof,
            leaf,
            async (result) => {
                if (!result.error) {
                    that.logger.trace(
                        `Successfully executed ${command.name} for agreement id: ${agreementId} ` +
                            `contract: ${contract}, token id: ${tokenId}, keyword: ${keyword}, ` +
                            `hash function id: ${hashFunctionId}. Retry number ${
                                COMMAND_RETRIES.SUBMIT_PROOFS - command.retries + 1
                            }`,
                    );
                } else if (command.retries - 1 === 0) {
                    this.logger.error(
                        `Failed executing submit proofs command, maximum number of retries reached. Error: ${result.error.message}. Scheduling next epoch check.`,
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
                    return;
                }
                await that.scheduleNextEpochCheck(
                    blockchain,
                    agreementId,
                    contract,
                    tokenId,
                    keyword,
                    epoch,
                    hashFunctionId,
                    agreementData,
                    operationId,
                    assertionId,
                );

                that.operationIdService.emitChangeEvent(
                    OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_PROOFS_END,
                    operationId,
                    agreementId,
                    epoch,
                );
            },
        );
        return EpochCommand.empty();
    }

    proofAlreadySubmitted(commits, myIdentity) {
        commits.forEach((commit) => {
            if (Number(commit.identityId) === myIdentity && Number(commit.score) === 0) {
                return true;
            }
        });
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
