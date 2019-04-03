const BN = require('../../../node_modules/bn.js/lib/bn');

const Command = require('../command');
const Utilities = require('../../Utilities');
const Models = require('../../../models/index');

/**
 * Repeatable command that checks whether offer is ready or not
 */
class DcOfferTaskCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.replicationService = ctx.replicationService;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { dataSetId, internalOfferId } = command.data;

        const dataSetIdNorm = Utilities.normalizeHex(dataSetId.toString('hex').padStart(64, '0'));
        const event = await Models.events.findOne({
            where: {
                event: 'OfferTask',
                data_set_id: dataSetIdNorm,
                finished: 0,
            },
        });
        if (event) {
            event.finished = true;
            await event.save({ fields: ['finished'] });

            const data = JSON.parse(event.data);
            const {
                task: eventTask,
            } = data;

            let {
                offerId: eventOfferId,
            } = data;
            eventOfferId = Utilities.normalizeHex(eventOfferId);

            const offer = await Models.offers.findOne({ where: { id: internalOfferId } });
            if (!offer) {
                throw new Error(`Offer with ID ${eventOfferId} cannot be found.`);
            }
            offer.task = eventTask;
            offer.offer_id = eventOfferId;
            offer.status = 'STARTED';
            offer.message = 'Offer has been successfully started. Waiting for DHs...';
            await offer.save({ fields: ['task', 'offer_id', 'status', 'message'] });
            this.remoteControl.offerUpdate({
                id: internalOfferId,
            });

            this.logger.trace(`Offer successfully started for data set ${dataSetIdNorm}. Offer ID ${eventOfferId}. Internal offer ID ${internalOfferId}.`);
            return this.continueSequence(this.pack(command.data), command.sequence);
        }
        return Command.repeat();
    }

    /**
     * Execute strategy when event is too late
     * @param command
     */
    async expired(command) {
        const { dataSetId, internalOfferId } = command.data;
        this.logger.notify(`Offer for data set ${dataSetId} has not been started.`);

        const offer = await Models.offers.findOne({ where: { id: internalOfferId } });
        offer.status = 'FAILED';
        offer.message = `Offer for data set ${dataSetId} has not been started.`;
        await offer.save({ fields: ['status', 'message'] });
        this.remoteControl.offerUpdate({
            id: internalOfferId,
        });

        await this.replicationService.cleanup(offer.id);
        return Command.empty();
    }

    /**
     * Pack data for DB
     * @param data
     */
    pack(data) {
        Object.assign(data, {
            dataSetId: Utilities.normalizeHex(data.dataSetId.toString('hex').padStart(64, '0')),
        });
        return data;
    }

    /**
     * Unpack data from database
     * @param data
     * @returns {Promise<*>}
     */
    unpack(data) {
        const parsed = data;
        Object.assign(parsed, {
            dataSetId: new BN(Utilities.denormalizeHex(data.dataSetId), 16),
        });
        return parsed;
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcOfferTaskCommand',
            delay: 0,
            period: 5000,
            deadline_at: Date.now() + (5 * 60 * 1000),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DcOfferTaskCommand;
