import Command from '../../../command.js';
import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    COMMAND_RETRIES,
} from '../../../../constants/constants.js';

class SubmitUpdateCommitCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.operationIdService = ctx.operationIdService;
        this.shardingTableService = ctx.shardingTableService;
        this.networkModuleManager = ctx.networkModuleManager;

        this.errorType = ERROR_TYPE.COMMIT_PROOF.SUBMIT_UPDATE_COMMIT_ERROR;
    }

    async execute(command) {
        const {
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            agreementData,
            agreementId,
            operationId,
        } = command.data;

        const epoch = await this.calculateCurrentEpoch(
            Number(agreementData.startTime),
            Number(agreementData.epochLength),
            blockchain,
        );

        if (command.retries === COMMAND_RETRIES.SUBMIT_UPDATE_COMMIT) {
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_UPDATE_COMMIT_START,
                operationId,
                agreementId,
                epoch,
            );
        }

        this.logger.trace(
            `Started ${command.name} for agreement id: ${command.data.agreementId} ` +
                `blockchain: ${blockchain} contract: ${contract}, token id: ${tokenId}, ` +
                `keyword: ${keyword}, hash function id: ${hashFunctionId}. Retry number ${
                    COMMAND_RETRIES.SUBMIT_UPDATE_COMMIT - command.retries + 1
                }`,
        );

        const hasPendingUpdate = await this.blockchainModuleManager.hasPendingUpdate(
            blockchain,
            tokenId,
        );

        if (!hasPendingUpdate) {
            this.logger.trace(`Not submitting as state is already finalized for update.`);
            return Command.empty();
        }

        await this.blockchainModuleManager.submitUpdateCommit(
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
            async (result) => {
                if (!result.error) {
                    this.operationIdService.emitChangeEvent(
                        OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_UPDATE_COMMIT_END,
                        operationId,
                        agreementId,
                        epoch,
                    );
                    this.logger.info('Successfully executed submit update commit');
                } else if (command.retries - 1 === 0) {
                    const errorMessage = `Failed executing submit update commit command, maximum number of retries reached. Error: ${result.error.message}`;
                    this.logger.error(errorMessage);
                    this.operationIdService.emitChangeEvent(
                        OPERATION_ID_STATUS.FAILED,
                        operationId,
                        errorMessage,
                        this.errorType,
                        epoch,
                    );
                } else {
                    const blockTime = this.blockchainModuleManager.getBlockTimeMillis(blockchain);
                    this.logger.warn(
                        `Failed executing submit update commit command, retrying in ${blockTime}ms. Error: ${result.error.message}`,
                    );
                    await this.commandExecutor.add({
                        name: 'submitUpdateCommitCommand',
                        delay: blockTime,
                        retries: command.retries - 1,
                        data: command.data,
                        transactional: false,
                    });
                }
            },
        );

        return Command.empty();
    }

    async calculateCurrentEpoch(startTime, epochLength, blockchain) {
        const now = await this.blockchainModuleManager.getBlockchainTimestamp(blockchain);
        return Math.floor((Number(now) - Number(startTime)) / Number(epochLength));
    }

    async retryFinished(command) {
        this.recover(command, `Max retry count for command: ${command.name} reached!`);
    }

    /**
     * Builds default submitUpdateCommitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'submitUpdateCommitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default SubmitUpdateCommitCommand;
