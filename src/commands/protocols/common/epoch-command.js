import Command from '../../command.js';
import { AGREEMENT_STATUS, OPERATION_ID_STATUS } from '../../../constants/constants.js';

class EpochCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
    }

    async scheduleNextEpochCheck(
        blockchain,
        agreementId,
        contract,
        tokenId,
        keyword,
        epoch,
        hashFunctionId,
        agreementData,
        operationId,
    ) {
        // todo check epoch number and make sure that delay is not in past
        const nextEpochStartTime =
            Number(agreementData.startTime) + Number(agreementData.epochLength) * (epoch + 1);

        // delay by 10% of commit window length
        const offset =
            ((Number(agreementData.epochLength) *
                Number(
                    await this.blockchainModuleManager.getCommitWindowDurationPerc(blockchain),
                )) /
                100) *
            0.1;

        const delay = nextEpochStartTime - Math.floor(Date.now() / 1000) + offset;

        this.logger.trace(
            `Scheduling next epoch check for agreement id: ${agreementId} in ${delay} seconds.`,
        );
        await this.commandExecutor.add({
            name: 'epochCheckCommand',
            sequence: [],
            delay,
            data: {
                blockchain,
                agreementId,
                contract,
                tokenId,
                keyword,
                epoch: epoch + 1,
                hashFunctionId,
                operationId,
            },
            transactional: false,
        });
    }

    async handleExpiredAsset(agreementId, operationId, epoch) {
        this.logger.trace(
            `Asset lifetime for agreement id: ${agreementId} has expired. Operation id: ${operationId}`,
        );
        await this.repositoryModuleManager.updateOperationAgreementStatus(
            operationId,
            agreementId,
            AGREEMENT_STATUS.EXPIRED,
        );
        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.EPOCH_CHECK_END,
            operationId,
            agreementId,
            epoch,
        );
    }

    /**
     * Recover system from failure
     * @param command
     * @param error
     */
    async recover(command, error) {
        this.logger.warn(`Failed to execute ${command.name}: error: ${error.message}`);

        await this.scheduleNextEpochCheck(
            command.data.blockchain,
            command.data.agreementId,
            command.data.contract,
            command.data.tokenId,
            command.data.keyword,
            command.data.epoch,
            command.data.hashFunctionId,
            command.data.agreementData,
            command.data.operationId,
        );

        return Command.empty();
    }

    async retryFinished(command) {
        this.recover(command, `Max retry count for command: ${command.name} reached!`);
    }

    /**
     * Builds default epochCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'epochCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default EpochCommand;
