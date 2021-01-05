const path = require('path');
const fs = require('fs');

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
        this.transport = ctx.transport;
        this.commandExecutor = ctx.commandExecutor;
        this.trailService = ctx.trailService;
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

    async handleReplicationData(dcNodeId, replicationMessage, response) {
        try {
            const {
                offer_id: offerId, otJson, permissionedData,
            } = replicationMessage;


            this.logger.notify(`Received replication data for offer_id ${offerId} from node ${dcNodeId}.`);

            const cacheDirectory = path.join(this.config.appDataPath, 'import_cache');

            await Utilities.writeContentsToFile(
                cacheDirectory,
                offerId,
                JSON.stringify({
                    otJson,
                    permissionedData,
                }),
            );

            const packedResponse = DHController._stripResponse(replicationMessage);
            Object.assign(packedResponse, {
                dcNodeId,
                documentPath: path.join(cacheDirectory, offerId),
            });

            await this.commandExecutor.add({
                name: 'dhReplicationImportCommand',
                data: packedResponse,
                transactional: false,
            });
        } catch (e) {
            await this.transport.sendResponse(response, { status: 'fail', message: e });
        }

        await this.transport.sendResponse(response, { status: 'success' });
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
        this.logger.api('POST: Trail request received.');

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
                response = await this.trailService._extendResponse(response);
            }

            res.status(200);
            res.send(response);
        } catch (e) {
            res.status(400);
            res.send(e);
        }
    }

    async lookupTrail(req, res) {
        this.logger.api('POST: Trail lookup request received.');

        if (req.body === undefined ||
            req.body.identifier_types === undefined ||
            req.body.identifier_values === undefined
        ) {
            const message = 'Unable to find data with given parameters! identifier_types, identifier_values, and opcode are required!';
            this.logger.info(message);
            res.status(400);
            res.send({
                message,
            });
            return;
        }

        const { identifier_types, identifier_values, opcode } = req.body;


        try {
            const response = await this.trailService.lookupTrail(
                identifier_types,
                identifier_values,
                opcode,
            );

            res.status(200);
            res.send(response);
        } catch (e) {
            this.logger.error(e.message);
            res.status(501);
            res.send({ errorMessage: 'Internal error' });
        }
    }

    async findTrail(req, res) {
        this.logger.api('POST: Trail find request received.');

        if (req.body === undefined ||
            req.body.unique_identifiers === undefined
        ) {
            const message = 'Unable to find data with given parameters! unique_identifiers is required!';
            this.logger.info(message);
            res.status(400);
            res.send({
                message,
            });
            return;
        }

        const {
            unique_identifiers, included_connection_types, excluded_connection_types,
        } = req.body;

        let { depth, reach } = req.body;

        depth = depth === undefined ?
            this.graphStorage.getDatabaseInfo().max_path_length :
            parseInt(depth, 10);

        reach = reach === undefined ?
            constants.TRAIL_REACH_PARAMETERS.narrow : reach.toLowerCase();

        const inserted_object = await Models.handler_ids.create({
            status: 'PENDING',
        });

        const commandData = {
            handler_id: inserted_object.dataValues.handler_id,
            unique_identifiers,
            depth,
            reach,
            included_connection_types,
            excluded_connection_types,
        };

        await this.commandExecutor.add({
            name: 'dhFindTrailCommand',
            delay: 0,
            transactional: false,
            data: commandData,
        });

        res.status(200);
        res.send({
            handler_id: inserted_object.dataValues.handler_id,
        });
    }

    async findTrailResult(req, res) {
        const handlerId = req.params.handler_id;
        this.logger.api(`POST: Trail result request received with handler id: ${handlerId}`);
        const handler_object = await Models.handler_ids.findOne({
            where: {
                handler_id: handlerId,
            },
        });

        if (!handler_object) {
            const message = 'Unable to find data with given parameters! handler_id is required!';
            this.logger.info(message);
            res.status(404);
            res.send({
                message,
            });
            return;
        }

        if (handler_object.status === 'COMPLETED') {
            const cacheDirectory = path.join(this.config.appDataPath, 'trail_cache');
            const filePath = path.join(cacheDirectory, handlerId);

            const fileContent = fs.readFileSync(filePath, { encoding: 'utf-8' });
            handler_object.data = JSON.parse(fileContent);
        }

        res.status(200);
        res.send({
            data: handler_object.data,
            status: handler_object.status,
        });
    }

    /**
     * Parse network response
     * @param response  - Network response
     * @private
     */
    static _stripResponse(response) {
        return {
            offerId: response.offer_id,
            dataSetId: response.data_set_id,
            dcWallet: response.dc_wallet,
            dcNodeId: response.dcNodeId,
            litigationPublicKey: response.litigation_public_key,
            litigationRootHash: response.litigation_root_hash,
            distributionPublicKey: response.distribution_public_key,
            distributionPrivateKey: response.distribution_private_key,
            distributionEpk: response.distribution_epk,
            transactionHash: response.transaction_hash,
            encColor: response.color,
            dcIdentity: response.dcIdentity,
        };
    }
}

module.exports = DHController;
