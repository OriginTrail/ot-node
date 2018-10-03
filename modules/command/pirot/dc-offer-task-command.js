const BN = require('bn.js');

const Command = require('../command');
const Utilities = require('../../Utilities');
const Models = require('../../../models/index');

const { Op } = Models.Sequelize;

/**
 * Repeatable command that checks whether offer is ready or not
 */
class DcOfferTaskCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { dataSetId, offerId } = command.data;

        const event = await Models.events.findOne({
            where: {
                event: 'OfferTask',
                data_set_id: Utilities.normalizeHex(dataSetId.toString('hex')),
                finished: 0,
            },
        });
        if (event) {
            this.logger.trace(`Offer successfully started for data set ${dataSetId}`);

            const { task, offerId: externalId } = JSON.parse(event.data);
            const offer = await Models.offers.findOne({
                where:
                    {
                        data_set_id: Utilities.normalizeHex(dataSetId.toString('hex')),
                        status: { [Op.in]: ['STARTED', 'PUBLISHED'] },
                    },
            });
            if (!offer) {
                throw new Error(`Offer with external ID ${offerId} doesn't exist`);
            }
            offer.task = task;
            offer.external_id = externalId;
            offer.status = 'STARTED';
            offer.message = 'Offer has been successfully started. Waiting for DHs...';
            await offer.save({ fields: ['task', 'external_id', 'status', 'message'] });
            return Command.empty();
        }
        return Command.repeat();
    }

    /**
     * Execute strategy when event is too late
     * @param command
     */
    async expired(command) {
        const { dataSetId, offerId } = command.data;
        this.logger.notify(`Offer for data set ${dataSetId} has not been started.`);

        const offer = await Models.offers.findOne({ where: { id: offerId } });
        offer.status = 'ABORTED';
        offer.message = `Offer for data set ${dataSetId} has not been started.`;
        await offer.save({ fields: ['status', 'message'] });
        return Command.empty();
    }

    /**
     * Pack data for DB
     * @param data
     */
    pack(data) {
        Object.assign(data, {
            dataSetId: Utilities.normalizeHex(data.dataSetId.toString('hex')),
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
