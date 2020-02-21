const Models = require('../../../models/index');
const Command = require('../command');
const Utilities = require('../../Utilities');

/**
 * Handles data read request.
 */
class DVPrivateDataReadRequestCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.transport = ctx.transport;
        this.web3 = ctx.web3;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        const {
            data_set_id,
            ot_object_id,
            seller_node_id,
            handlerId,
        } = command.data;

        const message = {
            data_set_id,
            ot_object_id,
            wallet: this.config.node_wallet,
            nodeId: this.config.identity,
            handler_id: handlerId,
        };
        const dataReadRequestObject = {
            message,
            messageSignature: Utilities.generateRsvSignature(
                JSON.stringify(message),
                this.web3,
                this.config.node_private_key,
            ),
        };

        await this.transport.sendPrivateDataReadRequest(
            dataReadRequestObject,
            seller_node_id,
        );

        return Command.empty();
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, error) {
        const { handler_id } = command.data;
        this.logger.warn(`Private Data request failed for handler ID ${handler_id}. ${error}.`);
        await Models.handler_ids.update(
            {
                status: 'FAILED',
                data: JSON.stringify({
                    error: error.message,
                }),
            },
            {
                where: {
                    handler_id,
                },
            },
        );
    }

    /**
     * Builds default DVDataReadRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dvPrivateDataReadRequestCommand',
            delay: 0,
            deadline_at: Date.now() + (5 * 60 * 1000),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DVPrivateDataReadRequestCommand;
