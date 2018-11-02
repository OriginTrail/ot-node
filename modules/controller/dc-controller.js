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
    }

    /**
     * Validate create offer request and import
     *
     * @param req   HTTP request
     * @param res   HTTP response
     */
    async createOffer(req, res) {
        this.logger.api('POST: Replication of imported data request received.');

        if (!this.apiUtilities.authorize(req, res)) {
            return;
        }

        if (req.body !== undefined && req.body.data_set_id !== undefined && typeof req.body.data_set_id === 'string' &&
            utilities.validateNumberParameter(req.body.holding_time_in_minutes) &&
            utilities.validateStringParameter(req.body.token_amount_per_holder) &&
            utilities.validateNumberParameter(req.body.litigation_interval_in_minutes)) {
            const dataset = await Models.data_info.findOne({
                where: { data_set_id: req.body.data_set_id },
            });
            if (dataset == null) {
                this.logger.info('Invalid request');
                res.status(404);
                res.send({
                    message: 'This data set does not exist in the database',
                });
                return;
            }

            const queryObject = {
                dataSetId: req.body.data_set_id,
                holdingTimeInMinutes: req.body.holding_time_in_minutes,
                tokenAmountPerHolder: req.body.token_amount_per_holder,
                litigationIntervalInMinutes: req.body.litigation_interval_in_minutes,
                response: res,
            };
            this.emitter.emit('api-create-offer', queryObject);
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

