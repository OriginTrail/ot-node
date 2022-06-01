const Command = require('../../command');
const constants = require('../../../constants');

class FindNodesCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.networkModuleManager = ctx.networkModuleManager;
        this.fileService = ctx.fileService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { documentPath } = command.data;

        const { assertion } = await this.fileService.loadJsonFromFile(documentPath);

        const keywords = assertion.metadata.keywords.concat(assertion.id);

        const findNodesPromises = keywords.map((keyword) => {
            this.logger.info(
                `Searching for closest ${this.config.replicationFactor} node(s) for keyword ${keyword}`,
            );
            return this.networkModuleManager
                .findNodes(
                    keyword,
                    constants.NETWORK_PROTOCOLS.STORE,
                    this.config.replicationFactor,
                )
                .then((foundNodes) => {
                    if (foundNodes.length < this.config.replicationFactor) {
                        this.logger.warn(
                            `Found only ${foundNodes.length} node(s) for keyword ${keyword}`,
                        );
                    }
                    return foundNodes;
                });
        });
        const results = await Promise.all(findNodesPromises);

        let nodes = new Set();
        for (const foundNodes of results) {
            for (const node of foundNodes) {
                nodes.add(node);
            }
        }
        nodes = [...nodes];

        const commandData = command.data;
        commandData.nodes = nodes;

        return this.continueSequence(commandData, command.sequence);
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        return Command.empty();
    }

    handleError(handlerId, error, msg) {
        this.logger.error({
            msg,
            Operation_name: 'Error',
            Event_name: constants.ERROR_TYPE.SEND_ASSERTION_ERROR,
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
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = FindNodesCommand;
