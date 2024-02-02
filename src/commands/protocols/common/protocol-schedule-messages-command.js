import Command from '../../command.js';

class ProtocolScheduleMessagesCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.protocolService = ctx.protocolService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            operationId,
            keyword,
            batchSize,
            leftoverNodes,
            numberOfFoundNodes,
            blockchain,
            minAckResponses,
        } = command.data;

        const currentBatchNodes = leftoverNodes.slice(0, batchSize);
        const currentBatchLeftoverNodes =
            batchSize < leftoverNodes.length ? leftoverNodes.slice(batchSize) : [];

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            this.startEvent,
        );

        this.logger.debug(
            `Trying to ${this.operationService.getOperationName()} to batch of ${
                currentBatchNodes.length
            } nodes for keyword : ${keyword}, leftover for retry: ${
                currentBatchLeftoverNodes.length
            }`,
        );

        const addCommandPromises = currentBatchNodes.map(async (node) => {
            const commandSequence = this.protocolService.getSenderCommandSequence(node.protocol);
            await this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                data: {
                    ...this.getNextCommandData(command),
                    blockchain,
                    operationId,
                    keyword,
                    node,
                    numberOfFoundNodes,
                    batchSize,
                    minAckResponses,
                    leftoverNodes: currentBatchLeftoverNodes,
                },
                period: 5000,
                retries: 3,
                transactional: false,
            });
        });

        await Promise.all(addCommandPromises);

        return Command.empty();
    }

    getNextCommandData(command) {
        const {
            assertionId,
            blockchain,
            contract,
            tokenId,
            hashFunctionId,
            proximityScoreFunctionsPairId,
        } = command.data;
        return {
            assertionId,
            blockchain,
            contract,
            tokenId,
            hashFunctionId,
            proximityScoreFunctionsPairId,
        };
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
