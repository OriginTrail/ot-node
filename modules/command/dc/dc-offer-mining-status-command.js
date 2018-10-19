const Command = require('../command');
const Models = require('../../../models/index');

/**
 * Repeatable command that checks whether offer is ready or not
 */
class DcOfferMiningStatusCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.replicationService = ctx.replicationService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { offerId } = command.data;

        const mined = await Models.miner_records.findOne({ where: { offer_id: offerId } });
        if (mined) {
            switch (mined.status) {
            case 'STARTED':
                return Command.repeat();
            case 'COMPLETED':
                return {
                    commands: [
                        {
                            name: 'dcOfferMiningCompletedCommand',
                            delay: 0,
                            data: {
                                offerId,
                                solution: mined.result,
                                success: true,
                            },
                            transactional: false,
                        },
                    ],
                };
            case 'FAILED':
                return {
                    commands: [
                        {
                            name: 'dcOfferMiningCompletedCommand',
                            delay: 0,
                            data: {
                                offerId,
                                success: false,
                            },
                            transactional: false,
                        },
                    ],
                };
            default:
                throw new Error(`Wrong miner status ${mined.status}`);
            }
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
        offer.status = 'FAILED';
        offer.message = `Offer for data set ${dataSetId} has not been started.`;
        await offer.save({ fields: ['status', 'message'] });

        await this.replicationService.deleteOfferDir(offer.id);
        return Command.empty();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcOfferMiningStatusCommand',
            delay: 0,
            period: 5000,
            deadline_at: Date.now() + (30 * 60 * 1000),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DcOfferMiningStatusCommand;
