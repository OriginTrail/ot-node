const Command = require('../../command');

class NetworkProtocolCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.commandExecutor = ctx.commandExecutor;
        this.operationService = ctx.publishService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { operationId } = command.data;
        const keywords = this.getKeywords(command);
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
                    ...this.getNextCommandData(command),
                    keyword,
                    operationId,
                    networkProtocol: this.operationService.getNetworkProtocol(),
                },
                transactional: false,
            }),
        );

        await Promise.all(addCommandPromises);

        return Command.empty();
    }

    getKeywords(command) {
        // overridden by subclasses
        return [];
    }

    getNextCommandData(command, keyword) {
        // overridden by subclasses
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

module.exports = NetworkProtocolCommand;
