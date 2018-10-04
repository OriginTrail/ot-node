const utilities = require('../Utilities');

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

        if (req.body !== undefined && req.body.import_id !== undefined && typeof req.body.import_id === 'string' &&
            utilities.validateNumberParameter(req.body.total_escrow_time_in_minutes) &&
            utilities.validateStringParameter(req.body.max_token_amount_per_dh) &&
            utilities.validateStringParameter(req.body.dh_min_stake_amount) &&
            utilities.validateNumberParameterAllowZero(req.body.dh_min_reputation)) {
            const queryObject = {
                import_id: req.body.import_id,
                total_escrow_time: req.body.total_escrow_time_in_minutes * 60000,
                max_token_amount: req.body.max_token_amount_per_dh,
                min_stake_amount: req.body.dh_min_stake_amount,
                min_reputation: req.body.dh_min_reputation,
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

