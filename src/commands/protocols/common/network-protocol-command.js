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
        const { blockchain } = command.data;

        const keywords = this.getKeywords(command);
        const batchSize = await this.getBatchSize(blockchain);
        const minAckResponses = await this.getMinAckResponses(blockchain);

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
