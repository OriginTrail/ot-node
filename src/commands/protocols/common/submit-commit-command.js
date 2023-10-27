import { OPERATION_ID_STATUS, ERROR_TYPE, COMMAND_RETRIES } from '../../../constants/constants.js';
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
        } = command.data;

        this.logger.trace(
            `Started the command for the Blockchain: ${blockchain}, ` +
                `Contract: ${contract}, Token ID: ${tokenId}, Service Agreement ID: ${agreementId}, ` +
                `Keyword: ${keyword}, Hash Function ID: ${hashFunctionId}, Epoch: ${epoch}, ` +
                `State Index: ${stateIndex}, Operation ID: ${operationId}, ` +
                `Retry number: ${COMMAND_RETRIES.SUBMIT_COMMIT - command.retries + 1}.`,
            command,
        );

        if (command.retries === COMMAND_RETRIES.SUBMIT_COMMIT) {
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_COMMIT_START,
                operationId,
                agreementId,
                epoch,
            );
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
                `Commit has been already submitted for the Blockchain: ${blockchain}, ` +
                    `Contract: ${contract}, Token ID: ${tokenId}, Service Agreement ID: ${agreementId}, ` +
                    `Keyword: ${keyword}, Hash Function ID: ${hashFunctionId}, Epoch: ${epoch}, ` +
                    `State Index: ${stateIndex}, Operation ID: ${operationId}.`,
                command,
            );
            return Command.empty();
        }

        const transactionCompletePromise = new Promise((resolve, reject) => {
            this.blockchainModuleManager.submitCommit(
                blockchain,
                contract,
                tokenId,
                keyword,
                hashFunctionId,
                epoch,
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
            `Successfully executed the command for for the Blockchain: ${blockchain}, ` +
                `Contract: ${contract}, Token ID: ${tokenId}, Service Agreement ID: ${agreementId}, ` +
                `Keyword: ${keyword}, Hash Function ID: ${hashFunctionId}, Epoch: ${epoch}, ` +
                `State Index: ${stateIndex}, Operation ID: ${operationId}, ` +
                `Retry number: ${COMMAND_RETRIES.SUBMIT_COMMIT - command.retries + 1}.`,
            command,
        );
        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_COMMIT_END,
            operationId,
            agreementId,
            epoch,
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
        this.recover(command, Error('Max retries have been exceeded!'));
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
