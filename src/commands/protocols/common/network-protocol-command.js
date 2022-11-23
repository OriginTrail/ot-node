import Command from '../../command.js';

class NetworkProtocolCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const keywords = this.getKeywords(command);
        const batchSize = await this.getBatchSize();
        const minAckResponses = await this.getMinAckResponses();

        const commandSequence = [
            'findNodesCommand',
            `${this.operationService.getOperationName()}ScheduleMessagesCommand`,
        ];

        const addCommandPromises = keywords.map((keyword) =>
            this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                data: {
                    ...command.data,
                    keyword,
                    batchSize,
                    minAckResponses,
                    errorType: this.errorType,
                    networkProtocols: this.operationService.getNetworkProtocols(),
                },
                transactional: false,
            }),
        );

        await Promise.all(addCommandPromises);

        return Command.empty();
    }

    getKeywords() {
        // overridden by subclasses
        return [];
    }

    async getBatchSize() {
        // overridden by subclasses
        return 0;
    }

    async getMinAckResponses() {
        // overridden by subclasses
        return 0;
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
