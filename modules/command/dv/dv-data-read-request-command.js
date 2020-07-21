const Models = require('../../../models/index');
const Command = require('../command');
const Utilities = require('../../Utilities');

/**
 * Handles data read request.
 */
class DVDataReadRequestCommand extends Command {
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
            dataSetId, replyId, handlerId, nodeId,
        } = command.data;

        const message = {
            id: replyId,
            data_set_id: dataSetId,
            wallet: this.config.node_wallet,
            nodeId: this.config.identity,
            handler_id: handlerId,
        };
        const dataReadRequestObject = {
            message,
            messageSignature: Utilities.generateRsvSignature(
                message,
                this.web3,
                this.config.node_private_key,
            ),
        };
        await this.transport.dataReadRequest(
            dataReadRequestObject,
            nodeId,
        );

        this.logger.info(`Data request sent for reply ID ${message.id}.`);
        return Command.empty();
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const { replyId, handlerId } = command.data;
        this.logger.warn(`Data request failed for reply ID ${replyId}. ${err}.`);
        await Models.handler_ids.update(
            {
                status: 'FAILED',
                data: JSON.stringify({
                    error: err.message,
                }),
            },
            {
                where: {
                    handler_id: handlerId,
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
            name: 'dvDataReadRequestCommand',
            delay: 0,
            deadline_at: Date.now() + (5 * 60 * 1000),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DVDataReadRequestCommand;
