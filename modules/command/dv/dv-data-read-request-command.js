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
        const { queryId, dataSetId, replyId } = command.data;
        /*
            dataReadRequestObject = {
            message: {
                id: REPLY_ID
                wallet: DV_WALLET,
                nodeId: KAD_ID,
                import_id: IMPORT_ID,
            },
            messageSignature: {
                c: …,
                r: …,
                s: …
            }
            }
         */

        const dataInfo = await Models.data_info.findOne({
            where: { data_set_id: dataSetId },
        });
        if (dataInfo) {
            this.logger.trace(`I've already stored data for import ID ${importId}. Purchase ignored.`);
            return Command.empty();
        }

        const offer = await Models.network_query_responses.findOne({
            where: {
                query_id: queryId,
                reply_id: replyId,
            },
        });

        const message = {
            id: offer.reply_id,
            data_set_id: dataSetId,
            wallet: this.config.node_wallet,
            nodeId: this.config.identity,
        };

        const dataReadRequestObject = {
            message,
            messageSignature: Utilities.generateRsvSignature(
                JSON.stringify(message),
                this.web3,
                this.config.node_private_key,
            ),
        };

        await this.transport.dataReadRequest(
            dataReadRequestObject,
            offer.node_id,
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
        const { replyId } = command.data;
        this.logger.warn(`Data request failed for reply ID ${replyId}. ${err}.`);
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
