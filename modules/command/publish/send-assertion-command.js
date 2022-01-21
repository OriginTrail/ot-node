const Command = require('../command');
const Models = require('../../../models/index');
const constants = require('../../constants');


class SendAssertionCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.networkService = ctx.networkService;
        this.publishService = ctx.publishService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            assets, keywords, handlerId, documentPath,
        } = command.data;

        const { rdf, assertion } = await this.fileService.loadJsonFromFile(documentPath);

        let nodes = [];
        for (const keyword of keywords) {
            this.logger.info(
                `Searching for closest ${this.config.replicationFactor} node(s) for keyword ${keyword}`,
            );
            const foundNodes = await this.networkService.findNodes(
                keyword,
                this.config.replicationFactor,
            );
            if (foundNodes.length < this.config.replicationFactor) {
                this.logger.warn(
                    `Found only ${foundNodes.length} node(s) for keyword ${keyword}`,
                );
            }
            nodes = nodes.concat(foundNodes);
        }
        nodes = [...new Set(nodes)];

        for (const node of nodes) {
            this.publishService.store({ rdf, id: assertion.id }, node).catch((e) => {
                this.handleError(handlerId, e, `Error while sending data with assertion id ${assertion.id} to node ${node._idB58String}. Error message: ${e.message}. ${e.stack}`);
            });
        }

        return this.continueSequence(command.data, command.sequence);
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
     * Builds default sendAssertionCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
    */
    default(map) {
        const command = {
            name: 'sendAssertionCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }

}

module.exports = SendAssertionCommand;
