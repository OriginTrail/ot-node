const fs = require('fs');
const ip = require('ip');
const restify = require('restify');
const corsMiddleware = require('restify-cors-middleware');

const Utilities = require('../Utilities');
const pjson = require('../../package.json');
const RestAPIValidator = require('../validator/rest-api-validator');

const utilities = require('../Utilities');
const Models = require('../../models');
const uuidv4 = require('uuid/v4');

class RestAPIServiceV2 {
    constructor(ctx) {
        this.ctx = ctx;
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.apiUtilities = ctx.apiUtilities;
        this.emitter = ctx.emitter;

        this.version_id = 'v2.0';
        this.stanards = ['OT-JSON', 'GS1-EPCIS', 'GRAPH', 'WOT'];
        this.graphStorage = ctx.graphStorage;
        this.mapping_standards_for_event = new Map();
        this.mapping_standards_for_event.set('ot-json', 'graph');
        this.mapping_standards_for_event.set('gs1-epcis', 'gs1');
        this.mapping_standards_for_event.set('graph', 'graph');
        this.mapping_standards_for_event.set('wot', 'wot');
    }

    /**
     * API Routes
     */
    _exposeAPIRoutes(server) {
        const {
            importController, dcController, transport, emitter,
            blockchain, web3, config,
        } = this.ctx;

        this._registerNodeInfoRoute(server, false);

        /**
         * Data import route
         * @param file - file or text data
         * @param standard_id - ID of file standard
         *        (supported standards are listed in this.standards array)
         */
        server.post(`/api/${this.version_id}/import`, async (req, res) => {
            await this._importDataset(req, res);
        });

        server.get(`/api/${this.version_id}/import/result/:handler_id`, async (req, res) => {
            await this._checkForHandlerStatus(req, res);
        });

        server.post(`/api/${this.version_id}/replicate`, async (req, res) => {
            await this._replicateDataset(req, res);
        });

        server.get(`/api/${this.version_id}/replicate/result/:handler_id`, async (req, res) => {
            await this._checkForHandlerStatus(req, res);
        });

        server.post(`/api/${this.version_id}/export`, async (req, res) => {
            await this._exportDataset(req, res);
        });

        server.get(`/api/${this.version_id}/export/result/:handler_id`, async (req, res) => {
            await this._checkForHandlerStatus(req, res);
        });

        server.get(`/api/${this.version_id}/standards`, async (req, res) => {
            this._getStandards(req, res);
        });

        server.get(`/api/${this.version_id}/get_element_issuer_identity/:element_id`, async (req, res) => {
            await this._getElementIssuerIdentity(req, res);
        });

        /** Local query routes */
        // TODO Add remaining query routes
        /**
         * Get trail from database
         * @param QueryObject - ex. {uid: abc:123}
         */
        server.get(`/api/${this.version_id}/trail`, (req, res, next) => { });

        /** Network related routes */
        server.get(`/api/${this.version_id}/network/get-contact/:node_id`, async (req, res) => {
            const nodeId = req.params.node_id;
            this.logger.api(`Get contact node ID ${nodeId}`);

            const result = await transport.getContact(nodeId);
            const body = {};

            if (result) {
                Object.assign(body, result);
            }
            res.status(200);
            res.send(body);
        });

        server.get(`/api/${this.version_id}/network/find/:node_id`, async (req, res) => {
            const nodeId = req.params.node_id;
            this.logger.api(`Find node ID ${nodeId}`);

            const result = await transport.findNode(nodeId);
            const body = {};

            if (result) {
                Object.assign(body, result);
            }
            res.status(200);
            res.send(body);
        });

        /**
         * Temporary route used for HTTP network prototype
         */
        server.post(`/api/${this.version_id}/network/send`, (req, res) => {
            this.logger.api('P2P request received');

            const { type } = req.body;
            emitter.emit(type, req, res);
        });

        /** Network queries & read requests, to be refactored */

        server.post(`/api/${this.version_id}/query/network`, (req, res, next) => {
            this.logger.api('POST: Network query request received.');

            let error = RestAPIValidator.validateBodyRequired(req.body);
            if (error) {
                return next(error);
            }

            const { query } = req.body;
            error = RestAPIValidator.validateSearchQuery(query);
            if (error) {
                return next(error);
            }

            emitter.emit('api-network-query', {
                query,
                response: res,
            });
        });

        server.get(`/api/${this.version_id}/query/network/:query_id`, (req, res) => {
            this.logger.api('GET: Query for status request received.');

            if (!req.params.query_id) {
                res.status(400);
                res.send({
                    message: 'Param required.',
                });
                return;
            }
            emitter.emit('api-network-query-status', {
                id: req.params.query_id,
                response: res,
            });
        });

        server.get(`/api/${this.version_id}/query/:query_id/responses`, (req, res) => {
            this.logger.api('GET: Local query responses request received.');

            if (!req.params.query_id) {
                res.status(400);
                res.send({
                    message: 'Param query_id is required.',
                });
                return;
            }
            emitter.emit('api-network-query-responses', {
                query_id: req.params.query_id,
                response: res,
            });
        });

        server.post(`/api/${this.version_id}/read/network`, (req, res) => {
            this.logger.api('POST: Network read request received.');

            if (req.body == null || req.body.query_id == null || req.body.reply_id == null
                || req.body.data_set_id == null) {
                res.status(400);
                res.send({ message: 'Bad request' });
                return;
            }
            const { query_id, reply_id, data_set_id } = req.body;

            emitter.emit('api-choose-offer', {
                query_id,
                reply_id,
                data_set_id,
                response: res,
            });
        });

        server.get(`/api/${this.version_id}/consensus/:sender_id`, (req, res) => {
            this.logger.api('GET: Consensus check events request received.');

            if (req.params.sender_id == null) {
                res.status(400);
                res.send({ message: 'Bad request' });
            }

            emitter.emit('api-consensus-events', {
                sender_id: req.params.sender_id,
                response: res,
            });
        });

        /**
         * Payout route
         * @param Query params: data_set_id
         */
        server.get(`/api/${this.version_id}/payout`, (req, res) => {
            this.logger.api('GET: Payout request received.');

            if (!req.query.offer_id) {
                res.status(400);
                res.send({
                    message: 'Param offer_id is required.',
                });
                return;
            }

            emitter.emit('api-payout', {
                offerId: req.query.offer_id,
                response: res,
            });
        });
    }

    /**
     * Register common info route
     * @param server - Server instance
     * @param isBootstrap - Is this a bootstrap node?
     * @private
     */
    _registerNodeInfoRoute(server, isBootstrap) {
        const {
            transport,
            config,
        } = this.ctx;

        server.get(`/api/${this.version_id}/info`, async (req, res) => {
            this.logger.api('GET: Node information request received.');

            try {
                const network = await transport.getNetworkInfo();
                const basicConfig = {
                    version: pjson.version,
                    blockchain: config.blockchain.blockchain_title,
                    network,
                    is_bootstrap: isBootstrap,
                };

                if (!isBootstrap) {
                    Object.assign(basicConfig, {
                        node_wallet: config.node_wallet,
                        erc_725_identity: config.erc725Identity,
                    });
                }

                res.status(200);
                res.send(basicConfig);
            } catch (error) {
                this.logger.error(`Failed to process /api/info route. ${error}`);
                res.status(500);
                res.send({
                    message: error,
                });
            }
        });
    }

    async _checkForHandlerStatus(req, res) {
        const handler_object = await Models.handler_ids.findOne({
            where: {
                handler_id: req.params.handler_id,
            },
        });

        if (handler_object == null) {
            this.logger.info('Invalid request');
            res.status(404);
            res.send({
                message: 'This data set does not exist in the database',
            });
            return;
        }

        const { data, status } = handler_object;

        res.status(200);
        res.send({
            data: JSON.parse(data),
            status,
        });
    }

    // This is hardcoded import in case it is needed to make new importer with this method
    async _importDataset(req, res) {
        this.logger.api('POST: Import of data request received.');

        if (req.body === undefined) {
            res.status(400);
            res.send({
                message: 'Bad request',
            });
            return;
        }

        // Check if import type is valid
        if (req.body.standard_id === undefined ||
            this.stanards.indexOf(req.body.standard_id) === -1) {
            res.status(400);
            res.send({
                message: 'Invalid import type',
            });
            return;
        }

        const standard_id = req.body.standard_id.toLowerCase();

        // Check if file is provided
        if (req.files !== undefined && req.files.file !== undefined) {
            const inputFile = req.files.file.path;
            try {
                const content = await utilities.fileContents(inputFile);
                const queryObject = {
                    content,
                    contact: req.contact,
                    response: res,
                };
                const inserted_object = await Models.handler_ids.create({
                    status: 'PENDING',
                });
                queryObject.handler_id = inserted_object.dataValues.handler_id;
                this.emitter.emit(`api-${this.mapping_standards_for_event.get(standard_id)}-import-request`, queryObject);
                res.status(200);
                res.send({
                    handler_id: inserted_object.dataValues.handler_id,
                });
            } catch (e) {
                res.status(400);
                res.send({
                    message: 'No import data provided',
                });
            }
        } else if (req.body.file !== undefined) {
            // Check if import data is provided in request body
            const queryObject = {
                content: req.body.file,
                contact: req.contact,
                response: res,
            };
            const inserted_object = await Models.handler_ids.create({
                status: 'PENDING',
            });
            queryObject.handler_id = inserted_object.dataValues.handler_id;
            this.emitter.emit(`api-${this.mapping_standards_for_event.get(standard_id)}-import-request`, queryObject);
            res.status(200);
            res.send({
                handler_id: inserted_object.dataValues.handler_id,
            });
        } else {
            // No import data provided
            res.status(400);
            res.send({
                message: 'No import data provided',
            });
        }
    }

    async _replicateDataset(req, res) {
        this.logger.api('POST: Replication of imported data request received.');

        if (req.body !== undefined && req.body.dataset_id !== undefined && typeof req.body.dataset_id === 'string' &&
            utilities.validateNumberParameter(req.body.data_lifespan) &&
            utilities.validateStringParameter(req.body.total_token_amount)) {
            const dataset = await Models.data_info.findOne({
                /**
                 * u tabeli data_info ovo polje se i
                 * dalje zove data_set_id a treba dataset_id po novom apiju
                 */
                where: { data_set_id: req.body.dataset_id },
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
                dataSetId: req.body.dataset_id,
                data_lifespan: req.body.data_lifespan,
                total_token_amount: req.body.total_token_amount,
                response: res,
            };
            const handler_data = {
                data_lifespan: queryObject.data_lifespan,
                total_token_amount: queryObject.total_token_amount,
                status: 'PUBLISHING_TO_BLOCKCHAIN',
                hold: [],
            };
            const inserted_object = await Models.handler_ids.create({
                status: 'PENDING',
                data: JSON.stringify(handler_data),
            });
            queryObject.handler_id = inserted_object.dataValues.handler_id;
            console.log(queryObject.handler_id);
            this.emitter.emit('api-create-offer', queryObject);
            res.status(200);
            res.send({
                handler_id: inserted_object.dataValues.handler_id,
            });
        } else {
            this.logger.error('Invalid request');
            res.status(400);
            res.send({
                message: 'Invalid parameters!',
            });
        }
    }

    /**
     * Still not implemented in another layers
     * @param req
     * @param res
     * @returns {Promise<void>}
     * @private
     */
    async _exportDataset(req, res) {
        this.logger.api('POST: Export of data request received.');

        if (req.body === undefined) {
            res.status(400);
            res.send({
                message: 'Bad request',
            });
            return;
        }

        let standard_id;
        // Check if import type is valid
        if (req.body.standard_id === undefined ||
            this.stanards.indexOf(req.body.standard_id) === -1) {
            standard_id = 'GRAPH'.toLowerCase();
        } else {
            // eslint-disable-next-line prefer-destructuring
            standard_id = req.body.standard_id.toLowerCase();
        }

        if (!this.mapping_standards_for_event.get(standard_id)) {
            res.status(400);
            res.send({
                message: 'Standard ID not supported',
            });
        }

        if (req.body.dataset_id === undefined) {
            res.status(400);
            res.send({
                message: 'Dataset_id is not provided',
            });
        }

        const requested_dataset = await Models.data_info.findOne({
            where: {
                data_set_id: req.params.dataset_id,
            },
        });

        if (requested_dataset === undefined) {
            res.status(400);
            res.send({
                message: 'Data set does not exist',
            });
        }

        const dataset_id = requested_dataset.dataValues.data_set_id;

        const object_to_export =
            {
                dataset_id: requested_dataset,
            };

        const inserted_object = await Models.handler_ids.create({
            data: JSON.stringify(object_to_export),
            status: 'PENDING',
        });

        const { handler_id } = inserted_object.dataValues;
        res.status(200);
        res.send({
            handler_id,
        });

        this.emitter.emit('api-export-request', { dataset_id, handler_id, standard: this.mapping_standards_for_event.get(standard_id) });
    }

    /**
     * Get all supported standards
     * @param req
     * @param res
     * @private
     */
    _getStandards(req, res) {
        const msg = [];
        this.stanards.forEach(standard =>
            msg.push(standard));
        res.send({
            message: msg,
        });
    }

    /**
     * Returns element issuer identity
     * @param req
     * @param res
     * @returns {Promise<void>}
     * @private
     */
    async _getElementIssuerIdentity(req, res) {
        this.logger.api('GET: Element issuer identity request received.');
        const elementId = req.params.element_id;
        if (!elementId) {
            res.status(400);
            res.send({
                message: 'Param element_id is required.',
            });
            return;
        }
        const result = await this.graphStorage.findIssuerIdentityForElementId(elementId);
        if (result && result.length > 0) {
            res.status(200);
            res.send(result);
        } else {
            res.status(400);
            res.send({
                message: 'Unable to find requested data',
            });
        }
    }
}


module.exports = RestAPIServiceV2;
