const Utilities = require('../Utilities');
const Models = require('../../models');

/**
 * Encapsulates DH related methods
 */
class DHController {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.blockchain = ctx.blockchain;
    }

    isParameterProvided(request, response, parameter_name) {
        if (!parameter_name) {
            throw Error('No parameter_name given');
        }

        if (request.body[parameter_name] == null) {
            response.status(400);
            response.send({
                message: `Bad request, ${parameter_name} is not provided`,
            });
            return false;
        }

        return true;
    }

    async whitelistViewer(request, response) {
        this.logger.api('POST: Whitelisting of data viewer request received.');

        if (request.body === undefined) {
            response.status(400);
            response.send({
                message: 'Bad request, request body is not provided',
            });
            return;
        }

        if (!this.isParameterProvided(request, response, 'dataset_id')
            || !this.isParameterProvided(request, response, 'ot_object_id')
            || !this.isParameterProvided(request, response, 'viewer_erc_id')) {
            return;
        }

        const { dataset_id, ot_object_id, viewer_erc_id } = request.body;
        const requested_object = await Models.data_sellers.findOne({
            where: {
                data_set_id: dataset_id,
                ot_json_object_id: ot_object_id,
                seller_erc_id: Utilities.normalizeHex(this.config.erc725Identity),
            },
        });

        if (requested_object === null) {
            response.status(400);
            response.send({
                message: 'Specified ot-object does not exist',
                status: 'FAILED',
            });
            return;
        }

        const buyerProfile =
            await this.blockchain.getProfile(Utilities.normalizeHex(viewer_erc_id));

        const buyer_node_id = Utilities.denormalizeHex(buyerProfile.nodeId.substring(0, 42));

        await Models.data_trades.create({
            data_set_id: dataset_id,
            ot_json_object_id: ot_object_id,
            buyer_node_id,
            buyer_erc_id: Utilities.normalizeHex(viewer_erc_id),
            seller_node_id: this.config.identity,
            seller_erc_id: this.config.erc725Identity.toLowerCase(),
            price: '0',
            status: 'COMPLETED',
        });

        response.status(200);
        response.send({
            message: `User ${Utilities.normalizeHex(viewer_erc_id)} has been ` +
                `whitelisted for ot-object ${ot_object_id} from dataset_id ${dataset_id}!`,
            status: 'SUCCESS',
        });
    }
}

module.exports = DHController;
