import Command from '../../command.js';

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
        serviceAgreement,
        operationId,
    ) {
        const nextEpochStartTime =
            serviceAgreement.startTime + serviceAgreement.epochLength * (epoch + 1);

        // delay by 10% of commit window length
        const offset =
            (await this.blockchainModuleManager.getCommitWindowDuration(blockchain)) * 0.1;

        const delay = nextEpochStartTime - Math.floor(Date.now() / 1000) + offset;

        this.logger.trace(
            `Scheduling next epoch check for agreement id: ${agreementId} in ${delay} seconds`,
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
                serviceAgreement,
                operationId,
            },
            transactional: false,
        });
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
            command.data.serviceAgreement,
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
