import Command from '../command.js';
import { ERROR_TYPE, PARANET_SYNC_FREQUENCY_MILLS } from '../../constants/constants.js';

class StartParanetSyncCommands extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;

        this.errorType = ERROR_TYPE.PARANET.START_PARANET_SYNC_ERROR;
    }

    async execute() {
        const operationId = this.operationIdService.generateId();

        this.logger.info(
            `Paranet sync: Starting Paranet sync command for operation id: ${operationId}`,
        );

        await this.commandExecutor.delete('paranetSyncCommand');

        await Promise.all(
            this.config.assetSync?.syncParanets.map(async (paranetId) => {
                // validate paranet id before scheduling paranet sync command

                const commandData = {
                    paranetId,
                    operationId,
                    // TODO: Pass in blockchain, contract and token ID
                };

                return this.commandExecutor.add({
                    name: 'paranetSyncCommand',
                    data: commandData,
                    period: PARANET_SYNC_FREQUENCY_MILLS,
                });
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
     * Builds default startParanetSyncCommands
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'startParanetSyncCommands',
            data: {},
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default StartParanetSyncCommands;
