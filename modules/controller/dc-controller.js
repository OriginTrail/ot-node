const utilities = require('../Utilities');
const Models = require('../../models');

/**
 * DC related API controller
 */
class DCController {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.emitter = ctx.emitter;
        this.apiUtilities = ctx.apiUtilities;
        this.config = ctx.config;
        this.dcService = ctx.dcService;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Validate create offer request and import
     *
     * @param req   HTTP request
     * @param res   HTTP response
     */
    async handleReplicateRequest(req, res) {
        if (req.body !== undefined && req.body.dataset_id !== undefined && typeof req.body.dataset_id === 'string' &&
            utilities.validateNumberParameter(req.body.holding_time_in_minutes) &&
            utilities.validateStringParameter(req.body.token_amount_per_holder) &&
            utilities.validateNumberParameter(req.body.litigation_interval_in_minutes)) {
            try {
                const dataset = await Models.data_info.findOne({
                    where: { data_set_id: req.body.dataset_id },
                });
                if (dataset == null) {
                    this.logger.info('Invalid request');
                    res.status(400);
                    res.send({
                        message: 'This data set does not exist in the database',
                    });
                    return;
                }
                let litigationIntervalInMinutes = req.body.litigation_interval_in_minutes;
                if (!litigationIntervalInMinutes) {
                    litigationIntervalInMinutes = this.config.dc_litigation_interval_in_minutes;
                }

                const handler_data = {
                    holding_time_in_minutes: req.body.holding_time_in_minutes,
                    token_amount_per_holder: req.body.token_amount_per_holder,
                    status: 'PUBLISHING_TO_BLOCKCHAIN',
                    hold: [],
                };
                const inserted_object = await Models.handler_ids.create({
                    status: 'PENDING',
                    data: JSON.stringify(handler_data),
                });

                await this.dcService.createOffer(
                    req.body.dataset_id, dataset.root_hash, req.body.holding_time_in_minutes,
                    req.body.token_amount_per_holder, dataset.otjson_size_in_bytes,
                    litigationIntervalInMinutes, inserted_object.dataValues.handler_id,
                    req.body.urgent,
                );

                res.status(200);
                res.send({
                    handler_id: inserted_object.dataValues.handler_id,
                });
            } catch (error) {
                this.logger.error(`Failed to create offer. ${error}.`);
                res.status(400);
                res.send({
                    message: `Failed to start offer. ${error}.`,
                });
                this.remoteControl.failedToCreateOffer(`Failed to start offer. ${error}.`);
            }
        } else {
            this.logger.error('Invalid request');
            res.status(400);
            res.send({
                message: 'Invalid parameters!',
            });
        }
    }
}

module.exports = DCController;

