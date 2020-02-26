const Command = require('../command');
const Utilities = require('../../Utilities');
const Models = require('../../../models');

/**
 * Handles data location response.
 */
class DhPurchaseResponseCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        const {
            data_set_id, dv_erc725_identity, handler_id, dv_node_id, ot_json_object_id, price,
        } = command.data;

        const permission = await Models.data_trades.findOne({
            where: {
                buyer_node_id: dv_node_id,
                data_set_id,
                ot_json_object_id,
            },
        });
        let message = '';
        let status = '';
        const sellingData = await Models.data_sellers.findOne({
            where: {
                data_set_id,
                ot_json_object_id,
                seller_node_id: this.config.identity,
            },
        });

        if (permission) {
            message = `Data purchase already completed or in progress! Previous purchase status: ${permission.status}`;
            status = 'FAILED';
        } else if (!sellingData) {
            status = 'FAILED';
            message = 'I dont have requested data';
        } else if (sellingData.price !== price) {
            message = `Can't accept purchase with price: ${price}, my price: ${sellingData.price}`;
            status = 'FAILED';
        } else {
            await Models.data_trades.create({
                data_set_id,
                ot_json_object_id,
                buyer_node_id: dv_node_id,
                buyer_erc_id: dv_erc725_identity,
                seller_node_id: this.config.identity,
                seller_erc_id: this.config.erc725Identity.toLowerCase(),
                price,
                status: 'REQUESTED',
            });

            // todo encode data and send it to dv

            message = 'Data purchase request completed!';
            status = 'SUCCESSFUL';
        }


        const response = {
            handler_id,
            status,
            wallet: this.config.node_wallet,
            message,
            price: sellingData.price,
            seller_node_id: this.config.identity,
            seller_erc_id: this.config.erc725Identity,
        };

        const dataPurchaseResponseObject = {
            message: response,
            messageSignature: Utilities.generateRsvSignature(
                JSON.stringify(response),
                this.web3,
                this.config.node_private_key,
            ),
        };

        await this.transport.sendDataPurchaseResponse(
            dataPurchaseResponseObject,
            dv_node_id,
        );

        if (status === 'FAILED') {
            return Command.empty();
        }
        const commandData = {
            data_set_id,
            ot_json_object_id,
            buyer_node_id: dv_node_id,
        };
        await this.commandExecutor.add({
            name: 'dvPurchaseKeyDepositedCommand',
            delay: 5 * 60 * 1000, // 5 min
            data: commandData,
            transactional: false,
        });
    }

    /**
     * Builds default DhPurchaseResponseCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhPurchaseResponseCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DhPurchaseResponseCommand;
