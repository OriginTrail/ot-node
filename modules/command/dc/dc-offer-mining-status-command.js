const Command = require('../command');
const Models = require('../../../models/index');
const constants = require('../../constants');

/**
 * Repeatable command that checks whether offer is ready or not
 */
class DcOfferMiningStatusCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.replicationService = ctx.replicationService;
        this.remoteControl = ctx.remoteControl;
        this.errorNotificationService = ctx.errorNotificationService;
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
            blockchain_id,
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
                                blockchain_id,
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
                                blockchain_id,
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
        const { offerId, handler_id, blockchain_id } = command.data;
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

        this.errorNotificationService.notifyError(
            err,
            {
                offerId: offer.offer_id,
                tokenAmountPerHolder: offer.token_amount_per_holder,
                litigationIntervalInMinutes: offer.litigation_interval_in_minutes,
                datasetId: offer.data_set_id,
                holdingTimeInMinutes: offer.holding_time_in_minutes,
                blockchain_id,
            },
            constants.PROCESS_NAME.offerHandling,
        );


        await this.replicationService.cleanup(offer.id);
        return Command.empty();
    }

    /**
     * Execute strategy when event is too late
     * @param command
     */
    async expired(command) {
        const {
            dataSetId, offerId, handler_id, blockchain_id,
        } = command.data;
        this.logger.notify(`Offer for data set ${dataSetId} has not been started on blockchain ${blockchain_id}.`);

        const offer = await Models.offers.findOne({ where: { offer_id: offerId } });
        offer.status = 'FAILED';
        offer.global_status = 'FAILED';
        offer.message = `Offer for data set ${dataSetId} has not been started
        .`;
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
