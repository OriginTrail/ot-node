const { v1: uuidv1 } = require('uuid');
const Command = require('../command');
const { ERROR_TYPE, NETWORK_PROTOCOLS } = require('../../constants/constants');

class FindNodesCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.networkModuleManager = ctx.networkModuleManager;
        this.fileService = ctx.fileService;
        this.handlerIdService = ctx.handlerIdService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { handlerId } = command.data;

        const assertion = await this.handlerIdService.getCachedHandlerIdData(handlerId);

        const keywords = assertion.metadata.keywords.concat(assertion.id);

        const findNodesPromises = keywords.map(async (keyword) => {
            this.logger.info(
                `Searching for closest ${this.config.replicationFactor} node(s) for keyword ${keyword}`,
            );
            const Id_operation = uuidv1();
            this.logger.emit({
                msg: 'Started measuring execution of find nodes',
                Event_name: 'find_nodes_start',
                Operation_name: 'find_nodes',
                Id_operation,
            });
            this.logger.emit({
                msg: 'Started measuring execution of kad find nodes',
                Event_name: 'kad_find_nodes_start',
                Operation_name: 'find_nodes',
                Id_operation,
            });
            const foundNodes = await this.networkModuleManager.findNodes(
                keyword,
                NETWORK_PROTOCOLS.STORE,
            );
            if (foundNodes.length < this.config.replicationFactor) {
                this.logger.warn(`Found only ${foundNodes.length} node(s) for keyword ${keyword}`);
            }
            this.logger.emit({
                msg: 'Finished measuring execution of kad find nodes ',
                Event_name: 'kad_find_nodes_end',
                Operation_name: 'find_nodes',
                Id_operation,
            });
            this.logger.emit({
                msg: 'Started measuring execution of rank nodes',
                Event_name: 'rank_nodes_start',
                Operation_name: 'find_nodes',
                Id_operation,
            });
            const closestNodes = await this.networkModuleManager.rankNodes(
                foundNodes,
                keyword,
                this.config.replicationFactor,
            );
            this.logger.emit({
                msg: 'Finished measuring execution of rank nodes',
                Event_name: 'rank_nodes_end',
                Operation_name: 'find_nodes',
                Id_operation,
            });
            this.logger.emit({
                msg: 'Finished measuring execution of find nodes',
                Event_name: 'find_nodes_end',
                Operation_name: 'find_nodes',
                Id_operation,
            });
            return closestNodes;
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

    handleError(handlerId, error, msg) {
        this.logger.error({
            msg,
            Operation_name: 'Error',
            Event_name: ERROR_TYPE.FIND_NODES_ERROR,
            Event_value1: error.message,
            Id_operation: handlerId,
        });
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
