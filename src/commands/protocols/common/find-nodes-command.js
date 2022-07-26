const Command = require('../../command');
const { OPERATION_ID_STATUS, NETWORK_PROTOCOLS } = require('../../../constants/constants');

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
        const { keyword, operationId, networkProtocol, errorType } = command.data;

        this.errorType = errorType;
        this.logger.debug(`Searching for closest node(s) for keyword ${keyword}`);

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.FIND_NODES_START,
        );

        const closestNodes = await this.networkModuleManager.findNodes(keyword, networkProtocol);

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.FIND_NODES_END,
        );

        this.logger.debug(`Found ${closestNodes.length} node(s) for keyword ${keyword}`);

        if (
            networkProtocol === NETWORK_PROTOCOLS.PUBLISH &&
            closestNodes.length < this.config.minimumReplicationFactor
        ) {
            this.handleError(
                operationId,
                `Unable to find enough nodes for ${networkProtocol}. Minimum replication factor: ${this.config.minimumReplicationFactor}`,
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

module.exports = FindNodesCommand;
