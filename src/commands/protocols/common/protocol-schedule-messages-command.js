import Command from '../../command.js';
import { OPERATION_ID_STATUS } from '../../../constants/constants.js';

class ProtocolScheduleMessagesCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.protocolService = ctx.protocolService;

        this.operationStartEvent = OPERATION_ID_STATUS.PROTOCOL_SCHEDULE_MESSAGE_START;
        this.operationEndEvent = OPERATION_ID_STATUS.PROTOCOL_SCHEDULE_MESSAGE_END;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            operationId,
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
            this.operationStartEvent,
        );

        this.logger.debug(
            `Trying to ${this.operationService.getOperationName()} to batch of ${
                currentBatchNodes.length
            }, leftover for retry: ${currentBatchLeftoverNodes.length}`,
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
                    node,
                    numberOfFoundNodes,
                    batchSize,
                    minAckResponses,
                    leftoverNodes: currentBatchLeftoverNodes,
                    isOperationV0: command.data.isOperationV0,
                },
                period: 5000,
                retries: 3,
                transactional: false,
            });
        });

        await Promise.all(addCommandPromises);

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            this.operationEndEvent,
        );

        return Command.empty();
    }

    getNextCommandData(command) {
        const { datasetRoot, blockchain } = command.data;
        return {
            blockchain,
            datasetRoot,
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
