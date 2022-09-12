import Command from '../../command.js';

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
        const { operationId, keyword, leftoverNodes, batchSize, nodesSeen = [] } = command.data;

        const currentBatchNodes = leftoverNodes.slice(0, batchSize);
        const currentBatchLeftoverNodes =
            batchSize < leftoverNodes.length ? leftoverNodes.slice(batchSize) : [];
        currentBatchNodes.forEach((node) => nodesSeen.push(node.toString()));

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
                    node,
                    numberOfFoundNodes: currentBatchLeftoverNodes.length + nodesSeen.length,
                    batchSize,
                    leftoverNodes: currentBatchLeftoverNodes,
                    nodesSeen,
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

export default ProtocolScheduleMessagesCommand;
