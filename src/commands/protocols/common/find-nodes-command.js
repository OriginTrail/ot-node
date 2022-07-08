const Command = require('../../command');
const {
    ERROR_TYPE,
    HANDLER_ID_STATUS,
    NETWORK_PROTOCOLS,
} = require('../../../constants/constants');

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
        const { keyword, handlerId, networkProtocol } = command.data;

        this.logger.debug(`Searching for closest node(s) for keyword ${keyword}`);

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.FIND_NODES_START,
        );

        const foundNodes = await this.networkModuleManager.findNodes(keyword, networkProtocol);
        const closestNodes = await this.networkModuleManager.rankNodes(foundNodes, keyword);

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.FIND_NODES_END,
        );

        this.logger.debug(`Found ${closestNodes.length} node(s) for keyword ${keyword}`);

        if (
            networkProtocol === NETWORK_PROTOCOLS.PUBLISH &&
            closestNodes.length < this.config.minimumReplicationFactor
        ) {
            this.handleError(
                handlerId,
                `Unable to find enough nodes for ${networkProtocol}. Minimum replication factor: ${this.config.minimumReplicationFactor}`,
                ERROR_TYPE.FIND_NODES_ERROR,
                true,
            );
            return Command.empty();
        }

        const commandData = command.data;
        commandData.leftoverNodes = closestNodes;
        commandData.numberOfFoundNodes = closestNodes.length;

        return this.continueSequence(commandData, command.sequence);
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
            errorType: ERROR_TYPE.FIND_NODES_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = FindNodesCommand;
