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
        this.remoteControl = ctx.remoteControl;
        this.profileService = ctx.profileService;
        this.blockchain = ctx.blockchain;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        const {
            data_set_id,
            ot_object_ids,
            seller_node_id,
            handler_id,
        } = command.data;

        const { node_wallet, node_private_key } = this.blockchain.getWallet().response;
        const identities = await this.blockchain.getAllIdentities();

        const message = {
            data_set_id,
            ot_object_ids,
            wallet: node_wallet,
            nodeId: this.config.identity,
            dv_erc725_identities: identities,
            handler_id,
        };
        const dataReadRequestObject = {
            message,
            messageSignature: Utilities.generateRsvSignature(
                message,
                node_private_key,
            ),
        };

        const result = await this.transport.sendPermissionedDataReadRequest(
            dataReadRequestObject,
            seller_node_id,
        );

        if (result && result.status === 'FAIL') {
            this.logger.warn(`Permissioned Data request failed for handler ID ${handler_id}. ${result.message}.`);
            await Models.handler_ids.update(
                {
                    status: 'FAILED',
                    data: JSON.stringify({
                        error: result.message,
                    }),
                },
                {
                    where: {
                        handler_id,
                    },
                },
            );
        }

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
