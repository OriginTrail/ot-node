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
        this.remoteControl = ctx.remoteControl;
        this.notifyError = ctx.notifyError;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            offerId,
            isReplacement,
            dhIdentity,
            handler_id,
        } = command.data;

        const mined = await Models.miner_tasks.findOne({
            limit: 1,
            where: {
                offer_id: offerId,
            },
            order: [
                ['id', 'DESC'],
            ],
        });
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
                                isReplacement,
                                solution: mined.result,
                                success: true,
                                dhIdentity,
                                excludedDHs: command.data.excludedDHs,
                                handler_id,
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
                                isReplacement,
                                handler_id,
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
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const { offerId, handler_id } = command.data;
        const offer = await Models.offers.findOne({ where: { offer_id: offerId } });
        offer.status = 'FAILED';
        offer.global_status = 'FAILED';
        offer.message = err.message;
        await offer.save({ fields: ['status', 'message', 'global_status'] });
        this.remoteControl.offerUpdate({
            offer_id: offerId,
        });
        Models.handler_ids.update({
            status: 'FAILED',
        }, { where: { handler_id } });

        // TODO Add error notification metadata
        this.notifyError(err);


        await this.replicationService.cleanup(offer.id);
        return Command.empty();
    }

    /**
     * Execute strategy when event is too late
     * @param command
     */
    async expired(command) {
        const { dataSetId, offerId, handler_id } = command.data;
        this.logger.notify(`Offer for data set ${dataSetId} has not been started.`);

        const offer = await Models.offers.findOne({ where: { offer_id: offerId } });
        offer.status = 'FAILED';
        offer.global_status = 'FAILED';
        offer.message = `Offer for data set ${dataSetId} has not been started.`;
        await offer.save({ fields: ['status', 'message', 'global_status'] });
        this.remoteControl.offerUpdate({
            offer_id: offerId,
        });
        Models.handler_ids.update({
            status: 'FAILED',
        }, { where: { handler_id } });

        await this.replicationService.cleanup(offer.id);
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
