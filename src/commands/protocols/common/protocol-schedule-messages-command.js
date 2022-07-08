const Command = require('../../command');
const { ERROR_TYPE } = require('../../../constants/constants');

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
        const { handlerId, keyword, leftoverNodes, numberOfFoundNodes } = command.data;

        const currentBatchNodes = leftoverNodes.slice(0, this.config.minimumReplicationFactor);
        const currentBatchLeftoverNodes =
            this.config.minimumReplicationFactor < leftoverNodes.length
                ? leftoverNodes.slice(this.config.minimumReplicationFactor)
                : [];

        await this.handlerIdService.updateHandlerIdStatus(handlerId, this.startEvent);

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
                    handlerId,
                    keyword,
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
            errorType: ERROR_TYPE.PUBLISH_START_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ProtocolScheduleMessagesCommand;
