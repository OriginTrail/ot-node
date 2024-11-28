import Command from '../../command.js';

class NetworkProtocolCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { blockchain, operationService } = command.data;

        // const keywords = await this.getKeywords(command);
        const batchSize = await operationService.getBatchSize(blockchain);
        const minAckResponses = await operationService.getMinAckResponses(blockchain);

        const commandSequence = [`${operationService.getOperationName()}ScheduleMessagesCommand`];

        await this.commandExecutor.add({
            name: commandSequence[0],
            sequence: commandSequence.slice(1),
            delay: 0,
            data: {
                ...command.data,
                batchSize,
                minAckResponses,
                errorType: this.errorType,
            },
            transactional: false,
        });

        return Command.empty();
    }

    async getKeywords() {
        throw Error('getKeywords not implemented');
    }

    async getBatchSize() {
        throw Error('getBatchSize not implemented');
    }

    async getMinAckResponses() {
        throw Error('getMinAckResponses not implemented');
    }

    /**
     * Builds default protocolNetworkCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'protocolNetworkCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default NetworkProtocolCommand;
