import Command from '../../command.js';
import { OPERATION_ID_STATUS } from '../../../constants/constants.js';

class FindShardCommand extends Command {
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
        const { operationId, blockchain, errorType, networkProtocols, minAckResponses } =
            command.data;

        this.errorType = errorType;
        this.logger.debug(`Searching for shard for operationId: ${operationId}`);

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.FIND_NODES_START,
        );

        // TODO: protocol selection
        const shardNodes = [];
        const foundNodes = await this.findShardNodes(blockchain);
        for (const node of foundNodes) {
            if (node.id !== this.networkModuleManager.getPeerId().toB58String()) {
                shardNodes.push({ id: node.id, protocol: networkProtocols[0] });
            }
        }

        this.logger.debug(`Found ${shardNodes.length} node(s) for operationId: ${operationId}`);
        this.logger.trace(
            `Found shard: ${JSON.stringify(
                shardNodes.map((node) => node.id),
                null,
                2,
            )}`,
        );

        if (shardNodes.length < minAckResponses) {
            await this.handleError(
                operationId,
                blockchain,
                `Unable to find enough nodes for operationId: ${operationId}. Minimum number of nodes required: ${minAckResponses}`,
                this.errorType,
                true,
            );
            return Command.empty();
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.FIND_NODES_END,
        );

        return this.continueSequence(
            {
                ...command.data,
                leftoverNodes: shardNodes,
                numberOfShardNodes: shardNodes.length,
            },
            command.sequence,
        );
    }

    async findShardNodes(blockchainId) {
        const shardNodes = await this.shardingTableService.findShard(
            blockchainId,
            true, // filter inactive nodes
        );

        // TODO: Optimize this so it's returned by shardingTableService.findShard
        const nodesFound = await Promise.all(
            shardNodes.map(({ peerId }) =>
                this.shardingTableService.findPeerAddressAndProtocols(peerId),
            ),
        );

        return nodesFound;
    }

    /**
     * Builds default findShardCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'findShardCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default FindShardCommand;
