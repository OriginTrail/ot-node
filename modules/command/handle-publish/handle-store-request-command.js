const Command = require('../command');
const constants = require('../../constants');

class HandleStoreRequestCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.networkModuleManager = ctx.networkModuleManager;
        this.dataService = ctx.dataService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { message, remotePeerId, operationId } = command.data;

        let status = false;
        try {
            const { jsonld, nquads } = await this.dataService.createAssertion(message.data.nquads);
            status = await this.dataService.verifyAssertion(jsonld, nquads);

            if (status) {
                await this.dataService.insert(
                    message.data.nquads.join('\n'),
                    `${constants.DID_PREFIX}:${message.data.id}`,
                );
                this.logger.info(`Assertion ${message.data.id} has been successfully inserted`);
            }
        } catch (e) {
            status = false;
        }

        const response = {
            header: {
                sessionId: message.header.sessionId,
                messageType: status ? 'REQUEST_ACK' : 'REQUEST_NACK',
            },
            data: {},
        };

        await this.networkModuleManager
            .sendMessageResponse(constants.NETWORK_PROTOCOLS.STORE, remotePeerId, response)
            .catch((e) => {
                this.handleError(
                    operationId,
                    e,
                    `Error while sending store request response to node ${remotePeerId._idB58String}. Error message: ${e.message}. ${e.stack}`,
                );
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
            Event_name: constants.ERROR_TYPE.HANDLE_STORE_REQUEST_ERROR,
            Event_value1: error.message,
            Id_operation: handlerId,
        });
    }

    /**
     * Builds default handleStoreRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'handleStoreRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = HandleStoreRequestCommand;
