const Command = require('../command');
const Utilities = require('../../Utilities');
const Models = require('../../../models');

/**
 * Handles data location response.
 */
class DvPurchaseRequestCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.remoteControl = ctx.remoteControl;
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.web3 = ctx.web3;
        this.transport = ctx.transport;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        const {
            data_set_id,
            handler_id,
            ot_object_id,
            seller_node_id,
        } = command.data;

        this.remoteControl.purchaseStatus('Initiating purchase', 'Your purchase request is being processed. Please be patient.');

        const dataSeller = await Models.data_sellers.findOne({
            where: {
                data_set_id,
                ot_json_object_id: ot_object_id,
                seller_node_id,
            },
        });

        if (!dataSeller) {
            const error = `Unable to find data seller info with params: ${data_set_id}, ${ot_object_id}, ${seller_node_id}`;
            this.logger.error(error);
            await Models.handler_ids.update(
                {
                    status: 'FAILED',
                    data: JSON.stringify({
                        error,
                    }),
                },
                {
                    where: {
                        handler_id,
                    },
                },
            );

            this.remoteControl.purchaseStatus('Purchase initiation failed', 'Unable to find data seller. Please try again.', true);
            return Command.empty();
        }

        const dataTrades = await Models.data_trades.findAll({
            where: {
                data_set_id,
                ot_json_object_id: ot_object_id,
                seller_node_id,
            },
        });

        if (dataTrades && dataTrades.length > 0) {
            const dataTrade = dataTrades.find(dataTrade => dataTrade.status !== 'FAILED');
            if (dataTrade) {
                const errorMessage = `Data purchase already completed or in progress! Previous purchase status: ${dataTrade.status}`;
                await this._handleError(errorMessage, handler_id);
                return Command.empty();
            }
        }

        const message = {
            data_set_id,
            dv_erc725_identity: this.config.erc725Identity,
            handler_id,
            ot_json_object_id: ot_object_id,
            price: dataSeller.price,
            wallet: this.config.node_wallet,
        };
        const dataPurchaseRequestObject = {
            message,
            messageSignature: Utilities.generateRsvSignature(
                message,
                this.web3,
                this.config.node_private_key,
            ),
        };


        await this.transport.sendDataPurchaseRequest(
            dataPurchaseRequestObject,
            seller_node_id,
        );

        await Models.data_trades.create({
            data_set_id,
            ot_json_object_id: ot_object_id,
            buyer_node_id: this.config.identity,
            buyer_erc_id: this.config.erc725Identity.toLowerCase(),
            seller_node_id,
            seller_erc_id: dataSeller.seller_erc_id,
            price: dataSeller.price,
            status: 'REQUESTED',
        });

        return Command.empty();
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const { handler_id } = command.data;
        await this._handleError(`${err}.`, handler_id);
        return Command.empty();
    }

    async _handleError(errorMessage, handler_id) {
        this.logger.error(`Purchase initiation failed. ${errorMessage}`);
        await Models.handler_ids.update(
            {
                status: 'FAILED',
                data: JSON.stringify({
                    errorMessage: `Purchase initiation failed. ${errorMessage}`,
                }),
            },
            {
                where: {
                    handler_id,
                },
            },
        );

        this.remoteControl.purchaseStatus('Purchase initiation failed', errorMessage, true);
    }


    /**
     * Builds default DvPurchaseRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dvPurchaseRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DvPurchaseRequestCommand;
