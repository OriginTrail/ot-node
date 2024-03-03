import Command from '../../../command.js';
import { ERROR_TYPE } from '../../../../constants/constants.js';

class EpochCheckCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.errorType = ERROR_TYPE.COMMIT_PROOF.EPOCH_CHECK_ERROR;
    }

    calculateCommandPeriod() {
        const devEnvironment =
            process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

        return devEnvironment ? 30_000 : 120_000;
    }

    async execute() {
        const operationId = this.operationIdService.generateId();

        this.logger.info(
            `Epoch check: Starting epoch check command for operation id: ${operationId}`,
        );

        await this.commandExecutor.delete('blockchainEpochCheckCommand');

        await Promise.all(
            this.blockchainModuleManager.getImplementationNames().map(async (blockchain) => {
                const commandData = {
                    blockchain,
                    operationId,
                };
                const peerRecord = await this.repositoryModuleManager.getPeerRecord(
                    this.networkModuleManager.getPeerId().toB58String(),
                    blockchain,
                );
                if (peerRecord != null) {
                    return this.commandExecutor.add({
                        name: 'blockchainEpochCheckCommand',
                        data: commandData,
                        period: this.calculateCommandPeriod(),
                    });
                }
            }),
        );

        return Command.empty();
    }

    /**
     * Recover system from failure
     * @param command
     * @param error
     */
    async recover(command) {
        this.logger.warn(`Failed to execute ${command.name}. Error: ${command.message}`);

        return Command.repeat();
    }

    /**
     * Builds default epochCheckCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'epochCheckCommand',
            data: {},
            transactional: false,
            period: this.calculateCommandPeriod(),
        };
        Object.assign(command, map);
        return command;
    }
}

export default EpochCheckCommand;
