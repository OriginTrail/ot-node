import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    COMMAND_RETRIES,
    BLOCK_TIME,
} from '../../../../constants/constants.js';
import Command from '../../../command.js';

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
            blockchain,
            operationId,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
            agreementId,
            stateIndex,
        } = command.data;
        if (command.retries === COMMAND_RETRIES.SUBMIT_COMMIT) {
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_COMMIT_START,
                operationId,
                agreementId,
                epoch,
            );
        }

        this.logger.trace(
            `Started ${command.name} for agreement id: ${agreementId} ` +
                `contract: ${contract}, token id: ${tokenId}, keyword: ${keyword}, ` +
                `hash function id: ${hashFunctionId}, epoch: ${epoch}, stateIndex: ${stateIndex}. Retry number ${
                    COMMAND_RETRIES.SUBMIT_COMMIT - command.retries + 1
                }`,
        );

        const that = this;
        await this.blockchainModuleManager.submitCommit(
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
            stateIndex,
            async (result) => {
                if (!result.error) {
                    that.logger.trace(
                        `Successfully executed ${command.name} for agreement id: ${agreementId} ` +
                            `contract: ${contract}, token id: ${tokenId}, keyword: ${keyword}, ` +
                            `hash function id: ${hashFunctionId}. Retry number ${
                                COMMAND_RETRIES.SUBMIT_COMMIT - command.retries + 1
                            }`,
                    );

                    await that.operationIdService.emitChangeEvent(
                        OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_COMMIT_END,
                        operationId,
                        agreementId,
                        epoch,
                    );
                } else if (command.retries - 1 === 0) {
                    const errorMessage = `Failed executing submit commit command, maximum number of retries reached. Error: ${result.error.message}.`;
                    that.logger.error(errorMessage);
                    await that.operationIdService.emitChangeEvent(
                        OPERATION_ID_STATUS.FAILED,
                        operationId,
                        errorMessage,
                        that.errorType,
                        epoch,
                    );
                } else {
                    const commandDelay = BLOCK_TIME * 1000; // one block
                    that.logger.warn(
                        `Failed executing submit commit command, retrying in ${commandDelay}ms. Error: ${result.error.message}`,
                    );
                    await that.commandExecutor.add({
                        name: 'submitCommitCommand',
                        sequence: [],
                        delay: commandDelay,
                        retries: command.retries - 1,
                        data: command.data,
                        transactional: false,
                    });
                }
            },
        );

        return Command.empty();
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
