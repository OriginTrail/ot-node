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

        this.errorType = errorType;
        this.logger.debug(`Searching for the closest node(s) for the keyword ${keyword}.`, command);

        // TODO: protocol selection
        const closestNodes = [];
        const foundNodes = await this.findNodes(blockchain, keyword, operationId, hashFunctionId);
        for (const node of foundNodes) {
            if (node.id !== this.networkModuleManager.getPeerId().toB58String()) {
                closestNodes.push({ id: node.id, protocol: networkProtocols[0] });
            }
        }

        this.logger.debug(
            `Found ${closestNodes.length} node(s) for the keyword ${keyword}.`,
            command,
        );
        this.logger.trace(
            `Found the neighbourhood: ${JSON.stringify(
                closestNodes.map((node) => node.id),
                null,
                2,
            )}`,
            command,
        );

        if (closestNodes.length < minAckResponses) {
            this.handleError(
                operationId,
                command,
                this.errorType,
                `Unable to find enough nodes. Minimum number of nodes required: ${minAckResponses}.`,
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

    async findNodes(blockchainId, keyword, operationId, hashFunctionId) {
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.FIND_NODES_START,
        );
        const r2 = await this.blockchainModuleManager.getR2(blockchainId);
        const closestNodes = await this.shardingTableService.findNeighbourhood(
            blockchainId,
            keyword,
            r2,
            hashFunctionId,
            true,
        );

        const nodesFound = await Promise.all(
            closestNodes.map(({ peerId }) =>
                this.shardingTableService.findPeerAddressAndProtocols(peerId),
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
