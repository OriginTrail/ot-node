import Command from '../../command.js';
import { OPERATION_ID_STATUS } from '../../../constants/constants.js';

class FindNodesCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.networkModuleManager = ctx.networkModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
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
            errorType,
            networkProtocols,
            hashFunctionId,
            minAckResponses,
        } = command.data;
        const proximityScoreFunctionsPairId = command.data.proximityScoreFunctionsPairId ?? 1;

        this.errorType = errorType;
        this.logger.debug(
            `Searching for closest node(s) for operationId: ${operationId}, keyword: ${keyword}`,
        );

        // TODO: protocol selection
        const closestNodes = [];
        const foundNodes = await this.findNodes(
            blockchain,
            keyword,
            operationId,
            hashFunctionId,
            proximityScoreFunctionsPairId,
        );
        for (const node of foundNodes) {
            if (node.id !== this.networkModuleManager.getPeerId().toB58String()) {
                closestNodes.push({ id: node.id, protocol: networkProtocols[0] });
            }
        }

        this.logger.debug(
            `Found ${closestNodes.length} node(s) for operationId: ${operationId}, keyword: ${keyword}`,
        );
        this.logger.trace(
            `Found neighbourhood: ${JSON.stringify(
                closestNodes.map((node) => node.id),
                null,
                2,
            )}`,
        );

        if (closestNodes.length < minAckResponses) {
            await this.handleError(
                operationId,
                blockchain,
                `Unable to find enough nodes for operationId: ${operationId}, keyword: ${keyword}. Minimum number of nodes required: ${minAckResponses}, number of nodes found: ${closestNodes.length}`,
                this.errorType,
                true,
            );
            return Command.empty();
        }

        return this.continueSequence(
            {
                ...command.data,
                leftoverNodes: closestNodes,
                numberOfFoundNodes: closestNodes.length,
            },
            command.sequence,
        );
    }

    async findNodes(
        blockchainId,
        keyword,
        operationId,
        hashFunctionId,
        proximityScoreFunctionsPairId,
    ) {
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchainId,
            OPERATION_ID_STATUS.FIND_NODES_START,
        );
        const r2 = await this.blockchainModuleManager.getR2(blockchainId);
        const closestNodes = await this.shardingTableService.findNeighbourhood(
            blockchainId,
            keyword,
            r2,
            hashFunctionId,
            proximityScoreFunctionsPairId,
            true, // filter inactive nodes
        );

        const nodesFound = await Promise.all(
            closestNodes.map(({ peerId }) =>
                this.shardingTableService.findPeerAddressAndProtocols(peerId),
            ),
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchainId,
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
