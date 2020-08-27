const Models = require('../../../models/index');
const Command = require('../command');
const Utilities = require('../../Utilities');

/**
 * Handles data read request.
 */
class DVPermissionedDataReadRequestCommand extends Command {
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
            handler_id,
        } = command.data;

        const message = {
            data_set_id,
            ot_object_id,
            wallet: this.config.node_wallet,
            nodeId: this.config.identity,
            dv_erc725_identity: this.config.erc725Identity,
            handler_id,
        };
        const dataReadRequestObject = {
            message,
            messageSignature: Utilities.generateRsvSignature(
                message,
                this.web3,
                this.config.node_private_key,
            ),
        };

        await this.transport.sendPermissionedDataReadRequest(
            dataReadRequestObject,
            seller_node_id,
        );

        return Command.empty();
    }

    /**
     * Recover system from failure
     * @param command
     * @param error
     */
    async recover(command, error) {
        const { handler_id } = command.data;
        this.logger.warn(`Permissioned Data request failed for handler ID ${handler_id}. ${error}.`);
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
     * Builds default DVPrivateDataReadRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dvPermissionedDataReadRequestCommand',
            delay: 0,
            deadline_at: Date.now() + (5 * 60 * 1000),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DVPermissionedDataReadRequestCommand;
