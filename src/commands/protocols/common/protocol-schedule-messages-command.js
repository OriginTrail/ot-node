const Command = require('../../command');

class ProtocolScheduleMessagesCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { operationId, keyword, keywords, leftoverNodes, numberOfFoundNodes } = command.data;

        const currentBatchNodes = leftoverNodes.slice(0, this.config.minimumReplicationFactor);
        const currentBatchLeftoverNodes =
            this.config.minimumReplicationFactor < leftoverNodes.length
                ? leftoverNodes.slice(this.config.minimumReplicationFactor)
                : [];

        await this.operationIdService.updateOperationIdStatus(operationId, this.startEvent);

        const commandSequence = [
            `${this.operationService.getOperationName()}InitCommand`,
            `${this.operationService.getOperationName()}RequestCommand`,
        ];

        this.logger.debug(
            `Trying to ${this.operationService.getOperationName()} to batch of ${
                currentBatchNodes.length
            } nodes for keyword : ${keyword}, leftover for retry: ${
                currentBatchLeftoverNodes.length
            }`,
        );

        const addCommandPromises = currentBatchNodes.map((node) =>
            this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                data: {
                    ...this.getNextCommandData(command),
                    operationId,
                    keyword,
                    keywords,
                    node,
                    numberOfFoundNodes,
                    numberOfNodesInBatch: currentBatchNodes.length,
                    leftoverNodes: currentBatchLeftoverNodes,
                },
                period: 5000,
                retries: 3,
                transactional: false,
            }),
        );

        await Promise.all(addCommandPromises);

        return Command.empty();
    }

    /**
     * Builds default protocolScheduleMessagesCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'protocolScheduleMessagesCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ProtocolScheduleMessagesCommand;
