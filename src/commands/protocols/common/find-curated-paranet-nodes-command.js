import Command from '../../command.js';
import { OPERATION_ID_STATUS } from '../../../constants/constants.js';

class FindCuratedParanetNodesCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.networkModuleManager = ctx.networkModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.shardingTableService = ctx.shardingTableService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { operationId, blockchain, errorType, networkProtocols, paranetId, minAckResponses } =
            command.data;

        this.errorType = errorType;
        this.logger.debug(
            `Searching for paranet (${paranetId}) node(s) for operationId: ${operationId}`,
        );

        // TODO: protocol selection
        const paranetNodes = [];
        const foundNodes = await this.findNodes(blockchain, operationId, paranetId);
        for (const node of foundNodes) {
            if (node.id !== this.networkModuleManager.getPeerId().toB58String()) {
                paranetNodes.push({ id: node.id, protocol: networkProtocols[0] });
            }
        }

        this.logger.debug(
            `Found ${paranetNodes.length} paranet (${paranetId}) node(s) for operationId: ${operationId}`,
        );
        this.logger.trace(
            `Found paranet (${paranetId}) nodes: ${JSON.stringify(
                paranetNodes.map((node) => node.id),
                null,
                2,
            )}`,
        );

        if (paranetNodes.length < minAckResponses) {
            await this.handleError(
                operationId,
                blockchain,
                `Unable to find enough paranet (${paranetId}) nodes for operationId: ${operationId}. Minimum number of nodes required: ${minAckResponses}`,
                this.errorType,
                true,
            );
            return Command.empty();
        }

        return this.continueSequence(
            {
                ...command.data,
                leftoverNodes: paranetNodes,
                numberOfFoundNodes: paranetNodes.length,
            },
            command.sequence,
        );
    }

    async findNodes(blockchainId, operationId, paranetId) {
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchainId,
            OPERATION_ID_STATUS.FIND_CURATED_PARANET_NODES_START,
        );

        const paranetCuratedNodes = await this.blockchainModuleManager.getParanetCuratedNodes(
            blockchainId,
            paranetId,
        );
        const paranetCuratedPeerIds = paranetCuratedNodes.map((node) =>
            this.blockchainModuleManager.convertHexToAscii(blockchainId, node.nodeId),
        );

        const paranetCuratedNodePeerRecords =
            await this.repositoryModuleManager.getPeerRecordsByIds(
                blockchainId,
                paranetCuratedPeerIds,
            );
        const availableParanetNodes = paranetCuratedNodePeerRecords.filter(
            (node) => node.lastSeen >= node.lastDialed,
        );

        const nodesFound = await Promise.all(
            availableParanetNodes.map(({ peerId }) =>
                this.shardingTableService.findPeerAddressAndProtocols(peerId),
            ),
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchainId,
            OPERATION_ID_STATUS.FIND_CURATED_PARANET_NODES_END,
        );

        return nodesFound;
    }

    /**
     * Builds default findCuratedParanetNodesCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'findCuratedParanetNodesCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default FindCuratedParanetNodesCommand;
