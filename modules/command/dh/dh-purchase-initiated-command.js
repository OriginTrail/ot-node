const Command = require('../command');
const Models = require('../../../models');

/**
 * Handles data location response.
 */
class DhPurchaseInitiatedCommand extends Command {
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
        const events = await Models.events.findAll({
            where: {
                event: 'PurchaseInitiated', // todo check event name
                finished: 0,
            },
        });
        if (events) {
            const {
                data_set_id,
                ot_json_object_id,
                buyer_node_id,
                encoded_object,
            } = command.data;
            // const event = events.find((e) => {
            //     const {
            //         sellerIdentity, buyerIdentity, encodedDataRootHash,
            //     } = JSON.parse(e.data);
            //     return Utilities.compareHexStrings(offerId, eventOfferId);
            // });
        }
        return Command.repeat();
        // fetch event from bc
        // validate root
        // validate root(ENC(x))
        // validate price
        // deposit key
        // schedule DhPurchaseTakePaymentCommand
    }

    /**
     * Builds default DhPurchaseInitiatedCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhPurchaseInitiatedCommand',
            delay: 5 * 60 * 1000, // 5 min
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DhPurchaseInitiatedCommand;
