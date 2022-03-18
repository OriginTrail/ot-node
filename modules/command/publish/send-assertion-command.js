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
        this.fileService = ctx.fileService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { documentPath, handlerId, operationId } = command.data;
        this.logger.emit({
            msg: 'Started measuring execution of replicate data to network',
            Event_name: 'publish_replicate_start',
            Operation_name: 'publish_replicate',
            Id_operation: operationId,
        });

        let { nquads, assertion } = await this.fileService.loadJsonFromFile(documentPath);

        if (!assertion.metadata.visibility) {
            nquads = nquads.filter((x) => x.startsWith(`<${constants.DID_PREFIX}:`));
        }

        let nodes = [];
        for (const keyword of assertion.metadata.keywords.concat(assertion.id)) {
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

        const storePromises = nodes.map((node) => this.publishService
            .store({ id: assertion.id, nquads }, node)
            .then((response) => {
                if (!response) {
                    this.logger.error({
                        msg: `Error while sending data with assertion id ${assertion.id} to node ${node._idB58String} - receiving node didn't stored the assertion.`,
                        Operation_name: 'Error',
                        Event_name: constants.ERROR_TYPE.SEND_ASSERTION_ERROR,
                        Id_operation: handlerId,
                    });
                } else if (response === 'busy') {
                    this.logger.error({
                        msg: `Error while sending data with assertion id ${assertion.id} to node ${node._idB58String} - receiving node is busy to store.`,
                        Operation_name: 'Error',
                        Event_name: constants.ERROR_TYPE.SEND_ASSERTION_ERROR_BUSY,
                        Id_operation: handlerId,
                    });
                }
            })
            .catch((e) => {
                this.handleError(
                    handlerId,
                    e,
                    `Error while sending data with assertion id ${assertion.id} to node ${node._idB58String}. Error message: ${e.message}. ${e.stack}`,
                );
            }));

        await Promise.all(storePromises);

        await Models.handler_ids.update(
            {
                status: 'COMPLETED',
            }, {
                where: {
                    handler_id: handlerId,
                },
            },
        );

        if (command.data.isTelemetry) {
            await Models.assertions.create({
                hash: assertion.id,
                topics: JSON.stringify(assertion.metadata.keywords[0]),
                createdAt: assertion.metadata.timestamp,
            });
        }

        this.logger.emit({
            msg: 'Finished measuring execution of replicate data to network',
            Event_name: 'publish_replicate_end',
            Operation_name: 'publish_replicate',
            Id_operation: operationId,
        });
        this.logger.emit({
            msg: 'Finished measuring execution of publish command',
            Event_name: 'publish_end',
            Operation_name: 'publish',
            Id_operation: operationId,
        });

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
