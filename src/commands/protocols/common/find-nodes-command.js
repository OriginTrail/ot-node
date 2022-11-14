import Command from '../../command.js';
import { OPERATION_ID_STATUS } from '../../../constants/constants.js';

class FindNodesCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.networkModuleManager = ctx.networkModuleManager;
        this.shardingTableService = ctx.shardingTableService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            keyword,
            operationId,
            blockchain,
            minimumAckResponses,
            errorType,
            networkProtocols,
            hashingAlgorithm,
        } = command.data;

        this.errorType = errorType;
        this.logger.debug(`Searching for closest node(s) for keyword ${keyword}`);

        // TODO: protocol selection
        const closestNodes = [];
        const foundNodes = await this.findNodes(keyword, operationId, blockchain, hashingAlgorithm);
        for (const node of foundNodes) {
            if (node.id !== this.networkModuleManager.getPeerId().toB58String()) {
                closestNodes.push({ id: node.id, protocol: networkProtocols[0] });
            }
        }

        this.logger.debug(`Found ${closestNodes.length} node(s) for keyword ${keyword}`);
        this.logger.trace(
            `Found neighbourhood: ${JSON.stringify(
                closestNodes.map((node) => node.id),
                null,
                2,
            )}`,
        );

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
                numberOfFoundNodes: closestNodes.length,
            },
            command.sequence,
        );
    }

    async findNodes(keyword, operationId, blockchainId, hashingAlgorithm) {
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.FIND_NODES_START,
        );
        const closestNodes = await this.shardingTableService.findNeighbourhood(
            keyword,
            blockchainId,
            await this.blockchainModuleManager.getR2(blockchainId),
            hashingAlgorithm,
        );

        const nodesFound = await Promise.all(
            closestNodes.map((node) =>
                this.shardingTableService.findPeerAddressAndProtocols(node.peer_id),
            ),
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.FIND_NODES_END,
        );

        return nodesFound;
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
