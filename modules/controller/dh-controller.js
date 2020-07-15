const Utilities = require('../Utilities');
const Models = require('../../models');
const constants = require('../constants');

/**
 * Encapsulates DH related methods
 */
class DHController {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.blockchain = ctx.blockchain;
        this.graphStorage = ctx.graphStorage;
        this.importService = ctx.importService;
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

    async getTrail(req, res) {
        if (req.body === undefined ||
            req.body.identifier_types === undefined ||
            req.body.identifier_values === undefined
        ) {
            res.status(400);
            res.send({
                message: 'Bad request',
            });
            return;
        }

        const { identifier_types, identifier_values } = req.body;

        if (Utilities.arrayze(identifier_types).length !==
            Utilities.arrayze(identifier_values).length) {
            res.status(400);
            res.send({
                message: 'Identifier array length mismatch',
            });
            return;
        }

        const depth = req.body.depth === undefined ?
            this.graphStorage.getDatabaseInfo().max_path_length :
            parseInt(req.body.depth, 10);

        const reach = req.body.reach === undefined ?
            constants.TRAIL_REACH_PARAMETERS.narrow : req.body.reach.toLowerCase();

        const { connection_types } = req.body;

        const keys = [];

        const typesArray = Utilities.arrayze(identifier_types);
        const valuesArray = Utilities.arrayze(identifier_values);

        for (let i = 0; i < typesArray.length; i += 1) {
            keys.push(Utilities.keyFrom(typesArray[i], valuesArray[i]));
        }

        try {
            const trail =
                await this.graphStorage.findTrail({
                    identifierKeys: keys,
                    depth,
                    connectionTypes: connection_types,
                });

            let response = this.importService.packTrailData(trail);

            if (reach === constants.TRAIL_REACH_PARAMETERS.extended) {
                response = await this._extendResponse(response);
            }

            res.status(200);
            res.send(response);
        } catch (e) {
            res.status(400);
            res.send(e);
        }
    }

    async _extendResponse(response) {
        const missingObjects = {};
        for (const trailElement of response) {
            const object = trailElement.otObject;

            const elementIsMissing =
                (array, element) => !array.find(e => e.otObject['@id'] === element['@id']);

            for (const relation of object.relations) {
                if (elementIsMissing(response, relation.linkedObject)) {
                    if (!missingObjects[relation.linkedObject['@id']]) {
                        missingObjects[relation.linkedObject['@id']] = trailElement.datasets;
                    } else {
                        missingObjects[relation.linkedObject['@id']] =
                            [...new Set(missingObjects[relation.linkedObject['@id']], trailElement.datasets)];
                    }
                }
            }
        }

        if (Object.keys(missingObjects).length > 0) {
            /*
              missingObjects: {
                id1: [  dataset 1,  dataset 2, ... ],
                id2: [  dataset 2,  dataset x, ... ],
                ...
              }
             */

            const missingIds = Object.keys(missingObjects);
            const missingElements =
                await this.graphStorage.findTrailExtension(missingIds, missingObjects);

            const trailExtension = this.importService.packTrailData(missingElements);

            return response.concat(trailExtension);
        }
    }
}

module.exports = DHController;
