const Command = require('../command');
const { ERROR_TYPE, HANDLER_ID_STATUS } = require('../../constants/constants');

class FindNodesCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.networkModuleManager = ctx.networkModuleManager;
        this.handlerIdService = ctx.handlerIdService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { handlerId, assertionId, ual, networkProtocol } = command.data;

        this.logger.info(
            `Searching for closest ${this.config.replicationFactor} node(s) for assertionId ${assertionId} and ual: ${ual}`,
        );

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.SEARCHING_FOR_NODES,
        );

        const keys = [assertionId, ual];

        const findNodesPromises = [];

        keys.forEach((key) => {
            findNodesPromises.push(this.findRankedNodes(key, networkProtocol));
        });

        const results = await Promise.all(findNodesPromises);

        let nodes = new Set();
        for (const closestNodes of results) {
            for (const node of closestNodes) {
                nodes.add(node);
            }
        }
        nodes = [...nodes];

        const commandData = command.data;
        commandData.nodes = nodes;

        return this.continueSequence(commandData, command.sequence);
    }

    async findRankedNodes(key, protocol) {
        this.logger.debug(
            `Searching for closest ${this.config.replicationFactor} node(s) for keyword ${key}`,
        );

        const foundNodes = await this.networkModuleManager.findNodes(key, protocol);

        const closestNodes = await this.networkModuleManager.rankNodes(foundNodes, key);
        this.logger.debug(`Found ${closestNodes.length} node(s) for keyword ${key}`);
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
            errorType: ERROR_TYPE.FIND_NODES_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = FindNodesCommand;
