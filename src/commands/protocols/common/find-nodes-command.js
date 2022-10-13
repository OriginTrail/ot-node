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
        const { keyword, operationId, minimumAckResponses, errorType, networkProtocols } =
            command.data;

        this.errorType = errorType;
        this.logger.debug(`Searching for closest node(s) for keyword ${keyword}`);

        const closestNodes = [];
        for (const node of await this.findNodes(keyword, operationId)) {
            for (const protocol of networkProtocols) {
                if (node.protocols.includes(protocol)) {
                    closestNodes.push({ id: node.id, protocol });
                    break;
                }
            }
        }

        this.logger.debug(`Found ${closestNodes.length} node(s) for keyword ${keyword}`);

        const batchSize = 2 * minimumAckResponses;
        if (closestNodes.length < batchSize) {
            this.handleError(
                operationId,
                `Unable to find enough nodes for ${operationId}. Minimum number of nodes required: ${batchSize}`,
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

    async findNodes(keyword, operationId) {
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.FIND_NODES_START,
        );

        const localPeers = (await this.networkModuleManager.findNodesLocal(keyword)).map((peer) =>
            peer.toString(),
        );

        const { nodes: closestNodes, telemetryData } = await this.networkModuleManager.findNodes(
            keyword,
        );

        const promises = [];
        for (const telemetry of telemetryData) {
            const {
                peerId,
                openConnectionStart,
                createStreamStart,
                sendMessageStart,
                sendMessageEnd,
            } = telemetry;
            const stringifiedPeerId = peerId.toString();

            promises.concat([
                this.operationIdService.updateOperationIdStatusWithValues(
                    operationId,
                    OPERATION_ID_STATUS.FIND_NODES_OPEN_CONNECTION_START,
                    stringifiedPeerId,
                    null,
                    openConnectionStart,
                ),
                this.operationIdService.updateOperationIdStatusWithValues(
                    operationId,
                    OPERATION_ID_STATUS.FIND_NODES_OPEN_CONNECTION_END,
                    stringifiedPeerId,
                    null,
                    createStreamStart,
                ),
                this.operationIdService.updateOperationIdStatusWithValues(
                    operationId,
                    OPERATION_ID_STATUS.FIND_NODES_CREATE_STREAM_START,
                    stringifiedPeerId,
                    null,
                    createStreamStart,
                ),
                this.operationIdService.updateOperationIdStatusWithValues(
                    operationId,
                    OPERATION_ID_STATUS.FIND_NODES_CREATE_STREAM_END,
                    stringifiedPeerId,
                    null,
                    sendMessageStart,
                ),
                this.operationIdService.updateOperationIdStatusWithValues(
                    operationId,
                    OPERATION_ID_STATUS.FIND_NODES_SEND_MESSAGE_START,
                    stringifiedPeerId,
                    null,
                    sendMessageStart,
                ),
                this.operationIdService.updateOperationIdStatusWithValues(
                    operationId,
                    OPERATION_ID_STATUS.FIND_NODES_SEND_MESSAGE_END,
                    stringifiedPeerId,
                    null,
                    sendMessageEnd,
                ),
            ]);
        }
        await Promise.all(promises);

        let differences = 0;
        for (const closestNode of closestNodes) {
            if (!localPeers.includes(closestNode.id.toString())) {
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
