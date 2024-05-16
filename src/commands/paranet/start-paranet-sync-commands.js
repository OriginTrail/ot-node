import Command from '../command.js';
import { ERROR_TYPE, PARANET_SYNC_FREQUENCY_MILLS } from '../../constants/constants.js';

class StartParanetSyncCommands extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.ualService = ctx.ualService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.errorType = ERROR_TYPE.PARANET.START_PARANET_SYNC_ERROR;
    }

    async execute() {
        const operationId = this.operationIdService.generateId();

        this.logger.info(
            `Paranet sync: Starting Paranet sync command for operation id: ${operationId}`,
        );

        await this.commandExecutor.delete('paranetSyncCommand');

        const promises = [];
        this.config.assetSync?.syncParanets.forEach(async (paranetUAL) => {
            const commandData = {
                paranetUAL,
                operationId,
            };

            promises.append(
                this.commandExecutor.add({
                    name: 'paranetSyncCommand',
                    data: commandData,
                    period: PARANET_SYNC_FREQUENCY_MILLS,
                }),
            );
        });

        await Promise.all(promises);

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
