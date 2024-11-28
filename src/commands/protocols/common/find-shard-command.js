import Command from '../../command.js';
import {
    OPERATION_ID_STATUS,
    NETWORK_PROTOCOLS,
    ERROR_TYPE,
} from '../../../constants/constants.js';

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
        const { operationId, blockchain, datasetRoot, operationService } = command.data;
        this.logger.debug(
            `Searching for shard for operationId: ${operationId}, dataset root: ${datasetRoot}`,
        );
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.FIND_NODES_START,
        );
        this.minAckResponses = operationService.getMinAckResponses(blockchain);
        this.errorType = ERROR_TYPE.FIND_SHARD.FIND_SHARD_ERROR;

        const networkProtocols = operationService.getNetworkProtocols();

        const shardNodes = [];
        let nodePartOfShard = false;

        const foundNodes = await this.findShardNodes(blockchain);

        const currentPeerId = this.networkModuleManager.getPeerId().toB58String();

        for (const node of foundNodes) {
            if (node.id === currentPeerId) {
                nodePartOfShard = true;
            } else {
                shardNodes.push({ id: node.id, protocol: networkProtocols[0] });
            }
        }
        // TODO: Schedule local command localStore or localGet
        // TODO: Maybe move this in child class so it only implements localCommand
        if (nodePartOfShard) {
            switch (networkProtocols[0]) {
                case NETWORK_PROTOCOLS.STORE:
                    command.sequence.push('localStoreCommand');
                    break;

                default:
                    break;
            }
        }

        this.logger.debug(
            `Found ${
                shardNodes.length + nodePartOfShard ? 1 : 0
            } node(s) for operationId: ${operationId}`,
        );
        // TODO: Log local node
        this.logger.trace(
            `Found shard: ${JSON.stringify(
                shardNodes.map((node) => node.id),
                null,
                2,
            )}`,
        );

        if (shardNodes.length + (nodePartOfShard ? 1 : 0) < this.minAckResponses) {
            await this.handleError(
                operationId,
                blockchain,
                `Unable to find enough nodes for operationId: ${operationId}. Minimum number of nodes required: ${this.minAckResponses}`,
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
