import Command from '../../command.js';
import { OPERATION_ID_STATUS } from '../../../constants/constants.js';

class FindNodesCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.networkModuleManager = ctx.networkModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { keyword, operationId, minimumAckResponses, networkProtocol, errorType } =
            command.data;

        this.errorType = errorType;
        this.logger.debug(`Searching for closest node(s) for keyword ${keyword}`);

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.FIND_NODES_START,
        );

        const {
            nodes: closestNodes,
            differences,
            routingTableSize,
        } = await this.networkModuleManager.findNodes(keyword, networkProtocol);

        await this.operationIdService.updateOperationIdStatusWithValues(
            operationId,
            OPERATION_ID_STATUS.FIND_NODES_END,
            differences,
            routingTableSize,
        );

        this.logger.debug(`Found ${closestNodes.length} node(s) for keyword ${keyword}`);

        const batchSize = 2 * minimumAckResponses;
        if (closestNodes.length < batchSize) {
            this.handleError(
                operationId,
                `Unable to find enough nodes for ${networkProtocol}. Minimum number of nodes required: ${batchSize}`,
                this.errorType,
                true,
            );
            return Command.empty();
        }

        return this.continueSequence(
            {
                ...command.data,
                batchSize,
                leftoverNodes: closestNodes,
                numberOfFoundNodes: closestNodes.length,
            },
            command.sequence,
        );
    }

    /**
     * Builds default findNodesCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'findNodesCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default FindNodesCommand;
