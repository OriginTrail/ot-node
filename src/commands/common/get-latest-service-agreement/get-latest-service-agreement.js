import Command from '../../command.js';
import { GET_LATEST_SERVICE_AGREEMENT_FREQUENCY_MILLS } from '../../../constants/constants.js';

class GetLatestServiceAgreement extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.shardingTableService = ctx.shardingTableService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute() {
        const operationId = this.operationIdService.generateId();

        this.logger.info(
            `Get latest service agreement: Starting get latest service agreement command for operation id: ${operationId}`,
        );

        await this.commandExecutor.delete('blockchainGetLatestServiceAgreement');

        await Promise.all(
            this.blockchainModuleManager.getImplementationNames().map(async (blockchain) => {
                const commandData = {
                    blockchain,
                    operationId,
                };

                return this.commandExecutor.add({
                    name: 'blockchainGetLatestServiceAgreement',
                    data: commandData,
                    period: GET_LATEST_SERVICE_AGREEMENT_FREQUENCY_MILLS,
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
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'getLatestServiceAgreement',
            data: {},
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default GetLatestServiceAgreement;
