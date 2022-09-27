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

        const closestNodes = await this.findNodes(keyword, networkProtocol, operationId);

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
            },
            command.sequence,
        );
    }

    async findNodes(keyword, networkProtocol, operationId) {
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.FIND_NODES_START,
        );

        const localPeers = (await this.networkModuleManager.findNodesLocal(keyword)).map((peer) =>
            peer.toString(),
        );
        // eslint-disable-next-line no-unused-vars
        const { nodes: closestNodes, telemetryData } = await this.networkModuleManager.findNodes(
            keyword,
            networkProtocol,
        );

        // TODO: send telemetry data

        let differences = 0;
        for (const closestNode of closestNodes) {
            if (!localPeers.includes(closestNode.toString())) {
                differences += 1;
            }
        }
        const routingTableSize = this.networkModuleManager.getRoutingTableSize();

        await this.operationIdService.updateOperationIdStatusWithValues(
            operationId,
            OPERATION_ID_STATUS.FIND_NODES_END,
            differences,
            routingTableSize,
        );

        return closestNodes;
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
