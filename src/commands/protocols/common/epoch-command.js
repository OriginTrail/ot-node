import Command from '../../command.js';
import { OPERATION_ID_STATUS } from '../../../constants/constants.js';

class EpochCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
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
        assertionId,
    ) {
        // todo check epoch number and make sure that delay is not in past
        const nextEpochStartTime =
            agreementData.startTime + agreementData.epochLength * (epoch + 1);

        const commitWindowDurationPerc =
            await this.blockchainModuleManager.getCommitWindowDurationPerc(blockchain);
        // delay by 10% of commit window length
        const offset = ((agreementData.epochLength * commitWindowDurationPerc) / 100) * 0.1;

        const now = await this.blockchainModuleManager.getBlockchainTimestamp(blockchain);

        const delay = nextEpochStartTime - now + offset;

        this.logger.trace(
            `Scheduling next epoch check for agreement id: ${agreementId} in ${delay} seconds.`,
        );
        await this.commandExecutor.add({
            name: 'epochCheckCommand',
            sequence: [],
            delay: delay * 1000,
            data: {
                blockchain,
                agreementId,
                contract,
                tokenId,
                keyword,
                hashFunctionId,
                operationId,
                assertionId,
            },
            transactional: false,
        });
    }

    async handleExpiredAsset(agreementId, operationId, epoch) {
        this.logger.trace(
            `Asset lifetime for agreement id: ${agreementId} has expired. Operation id: ${operationId}`,
        );
        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.EPOCH_CHECK_END,
            operationId,
            agreementId,
            epoch,
        );
    }

    async calculateCurrentEpoch(startTime, epochLength, blockchain) {
        const now = await this.blockchainModuleManager.getBlockchainTimestamp(blockchain);
        return Math.floor((now - startTime) / epochLength);
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
            command.data.assertionId,
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
