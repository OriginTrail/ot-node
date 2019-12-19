const pjson = require('../../package.json');
const RestAPIValidator = require('../validator/rest-api-validator');
const ImportUtilities = require('../ImportUtilities');
const utilities = require('../Utilities');
const Models = require('../../models');

class RestAPIServiceV2 {
    constructor(ctx) {
        this.ctx = ctx;
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.apiUtilities = ctx.apiUtilities;
        this.emitter = ctx.emitter;
        this.commandExecutor = ctx.commandExecutor;
        this.epcisOtJsonTranspiler = ctx.epcisOtJsonTranspiler;
        this.wotOtJsonTranspiler = ctx.wotOtJsonTranspiler;
        this.dcController = ctx.dcController;

        this.dvController = ctx.dvController;
        this.remoteControl = ctx.remoteControl;

        this.graphStorage = ctx.graphStorage;
        this.importService = ctx.importService;

        this.version_id = 'v2.0';
        this.stanards = ['OT-JSON', 'GS1-EPCIS', 'GRAPH', 'WOT'];
        this.graphStorage = ctx.graphStorage;
        this.mapping_standards_for_event = new Map();
        this.mapping_standards_for_event.set('ot-json', 'ot-json');
        this.mapping_standards_for_event.set('gs1-epcis', 'gs1');
        this.mapping_standards_for_event.set('graph', 'ot-json');
        this.mapping_standards_for_event.set('wot', 'wot');
    }

    /**
     * API Routes
     */
    _exposeAPIRoutes(server) {
        const {
            transport, emitter, blockchain, web3, config,
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

        server.get(`/api/${this.version_id}/get_connection_types/:standard_id`, async (req, res) => {
            await this._getConnectionTypes(req, res);
        });

        server.get(`/api/${this.version_id}/get_dataset_info/:dataset_id`, async (req, res) => {
            await this._getDatasetInfo(req, res);
        });

        server.post(`/api/${this.version_id}/trail`, async (req, res) => {
            await this._getTrail(req, res);
        });

        server.post(`/api/${this.version_id}/get_merkle_proofs`, async (req, res) => {
            await this._getMerkleProofs(req, res);
        });

        server.post(`/api/${this.version_id}/network/query`, async (req, res) => {
            await this._networkQuery(req, res);
        });

        server.get(`/api/${this.version_id}/network/query/result/:query_id`, async (req, res) => {
            await this._networkQueryStatus(req, res);
        });

        server.get(`/api/${this.version_id}/network/query/responses/:query_id`, async (req, res) => {
            await this._networkQueryResponses(req, res);
        });

        server.post(`/api/${this.version_id}/network/read`, async (req, res) => {
            await this._readNetwork(req, res);
        });

        server.get(`/api/${this.version_id}/network/read/result/:handler_id`, async (req, res) => {
            await this._checkForHandlerStatus(req, res);
        });

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

        server.post(`/api/${this.version_id}/query/local`, (req, res, next) => {
            this.logger.api('POST: Local query request received.');

            let error = RestAPIValidator.validateBodyRequired(req.body);
            if (error) {
                return next(error);
            }

            const queryObject = req.body.query;
            error = RestAPIValidator.validateSearchQuery(queryObject);
            if (error) {
                return next(error);
            }

            // TODO: Decrypt returned vertices
            emitter.emit('api-query', {
                query: queryObject,
                response: res,
            });
        });

        server.get(`/api/${this.version_id}/query/local/import/:data_set_id`, (req, res) => {
            this.logger.api('GET: Local import request received.');

            if (!req.params.data_set_id) {
                res.status(400);
                res.send({
                    message: 'Param required.',
                });
                return;
            }

            emitter.emit('api-query-local-import', {
                data_set_id: req.params.data_set_id,
                format: ((req.query && req.query.format) || 'otjson'),
                encryption: req.query.encryption,
                request: req,
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

        /** Get root hash for provided data query
         * @param Query params: data_set_id
         */
        server.get(`/api/${this.version_id}/fingerprint`, (req, res) => {
            this.logger.api('GET: Fingerprint request received.');

            const queryObject = req.query;
            emitter.emit('api-get_root_hash', {
                query: queryObject,
                response: res,
            });
        });

        server.get(`/api/${this.version_id}/import_info`, async (req, res) => {
            this.logger.api('GET: import_info.');

            const queryObject = req.query;
            if (queryObject.data_set_id == null) {
                res.send({ status: 400, message: 'Missing parameter!', data: [] });
                return;
            }

            this.emitter.emit('api-import-info', {
                dataSetId: queryObject.data_set_id,
                responseFormat: queryObject.format || 'otjson',
                response: res,
            });
        });

        server.get(`/api/${this.version_id}/balance`, async (req, res) => {
            this.logger.api('Get balance.');

            try {
                const humanReadable = req.query.humanReadable === 'true';

                const walletEthBalance = await web3.eth.getBalance(config.node_wallet);
                const walletTokenBalance = await utilities.getTracTokenBalance(
                    web3,
                    config.node_wallet,
                    blockchain.getTokenContractAddress(),
                    false,
                );
                const profile = await blockchain.getProfile(config.erc725Identity);
                const profileMinimalStake = await blockchain.getProfileMinimumStake();

                const body = {
                    wallet: {
                        address: config.node_wallet,
                        ethBalance: humanReadable ? web3.utils.fromWei(walletEthBalance, 'ether') : walletEthBalance,
                        tokenBalance: humanReadable ? web3.utils.fromWei(walletTokenBalance, 'ether') : walletTokenBalance,
                    },
                    profile: {
                        staked: humanReadable ? web3.utils.fromWei(profile.stake, 'ether') : profile.stake,
                        reserved: humanReadable ? web3.utils.fromWei(profile.stakeReserved, 'ether') : profile.stakeReserved,
                        minimalStake: humanReadable ? web3.utils.fromWei(profileMinimalStake, 'ether') : profileMinimalStake,
                    },
                };

                res.status(200);
                res.send(body);
            } catch (error) {
                this.logger.error(`Failed to get balance. ${error.message}.`);
                res.status(503);
                res.send({});
            }
        });

        server.get(`/api/${this.version_id}/imports_info`, (req, res) => {
            this.logger.api('GET: List imports request received.');

            emitter.emit('api-imports-info', {
                response: res,
            });
        });

        server.get(`/api/${this.version_id}/dump/rt`, (req, res) => {
            this.logger.api('Dumping routing table');
            const message = transport.dumpContacts();

            res.status(200);
            res.send({
                message,
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

    async _getTrail(req, res) {
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

        if (utilities.arrayze(identifier_types).length !==
            utilities.arrayze(identifier_values).length) {
            res.status(400);
            res.send({
                message: 'Identifier array length mismatch',
            });
            return;
        }

        const depth = req.body.depth === undefined ?
            this.graphStorage.getDatabaseInfo().max_path_length :
            parseInt(req.body.depth, 10);

        const { connection_types } = req.body;

        const keys = [];

        const typesArray = utilities.arrayze(identifier_types);
        const valuesArray = utilities.arrayze(identifier_values);

        const { length } = typesArray;

        for (let i = 0; i < length; i += 1) {
            keys.push(utilities.keyFrom(typesArray[i], valuesArray[i]));
        }

        try {
            const trail =
                await this.graphStorage.findTrail({
                    identifierKeys: keys,
                    depth,
                    connectionTypes: connection_types,
                });

            const response = await this.importService.packTrailData(trail);

            res.status(200);
            res.send(response);
        } catch (e) {
            res.status(400);
            res.send(e);
        }
    }

    async _getMerkleProofs(req, res) {
        this.logger.api('POST: Get Merkle proofs request received.');

        if (req.body === undefined) {
            res.status(400);
            res.send({
                message: 'Bad request',
            });
            return;
        }

        if (req.body.object_ids === undefined ||
            req.body.dataset_id === undefined) {
            res.status(400);
            res.send({
                message: 'Bad request',
            });
            return;
        }

        const { object_ids, dataset_id } = req.body;

        const response =
            await this.importService.getMerkleProofs(utilities.arrayze(object_ids), dataset_id);

        res.status(200);
        res.send(response);
    }

    async _networkQuery(req, res) {
        this.logger.api('POST: Network query request received.');

        let error = RestAPIValidator.validateBodyRequired(req.body);
        if (error) {
            res.status(400);
            res.send({
                message: error.message,
            });
            return;
        }

        const { query } = req.body;
        error = RestAPIValidator.validateSearchQuery(query);
        if (error) {
            res.status(400);
            res.send({
                message: error.message,
            });
            return;
        }

        this.logger.info('Network-query handling triggered.');

        const queryId = await this.dvController.queryNetwork(query, res);

        if (queryId) {
            res.status(200);
            res.send({
                query_id: queryId,
            });
        }
    }

    async _networkQueryStatus(req, res) {
        this.logger.api('GET: Query for status request received.');

        if (!req.params.query_id) {
            res.status(400);
            res.send({
                message: 'Missing Query ID parameter.',
            });
            return;
        }

        await this.dvController.handleNetworkQueryStatus(req.params.query_id, res);
    }

    async _networkQueryResponses(req, res) {
        this.logger.api('GET: Local query responses request received.');

        if (!req.params.query_id) {
            res.status(400);
            res.send({
                message: 'Param query_id is required.',
            });
            return;
        }

        await this.dvController.getNetworkQueryResponses(req.params.query_id, res);
    }

    async _readNetwork(req, res) {
        this.logger.api('POST: Network read request received.');

        if (req.body == null || req.body.reply_id == null
            || req.body.data_set_id == null) {
            res.status(400);
            res.send({ message: 'Params reply_id and data_set_id are required.' });
            return;
        }
        const { reply_id, data_set_id } = req.body;

        await this.dvController.handleDataReadRequest(data_set_id, reply_id, res);
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
                message: 'Unable to find data with given parameters!',
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

        const standard_id =
            this.mapping_standards_for_event.get(req.body.standard_id.toLowerCase());

        let fileContent;
        if (req.files !== undefined && req.files.file !== undefined) {
            const inputFile = req.files.file.path;
            fileContent = await utilities.fileContents(inputFile);
        } else if (req.body.file !== undefined) {
            fileContent = req.body.file;
        }

        if (fileContent) {
            try {
                const inserted_object = await Models.handler_ids.create({
                    status: 'PENDING',
                });
                const commandData = {
                    standard_id,
                    document: fileContent,
                    handler_id: inserted_object.dataValues.handler_id,
                };
                const commandSequence = [
                    'dcConvertToOtJsonCommand',
                    'dcConvertToGraphCommand',
                    'dcWriteImportToGraphDbCommand',
                    'dcFinalizeImportCommand',
                ];

                await this.commandExecutor.add({
                    name: commandSequence[0],
                    sequence: commandSequence.slice(1),
                    delay: 0,
                    data: commandData,
                    transactional: false,
                });
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
        } else {
            res.status(400);
            res.send({
                message: 'No import data provided',
            });
        }
    }

    async _replicateDataset(req, res) {
        this.logger.api('POST: Replication of imported data request received.');

        this.dcController.handleReplicateRequest(req, res);
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
                data_set_id: req.body.dataset_id,
            },
        });

        if (requested_dataset === null) {
            res.status(400);
            res.send({
                message: 'Data set does not exist',
            });
            return;
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

    _getConnectionTypes(req, res) {
        const standard_id = req.params.standard_id.toLocaleLowerCase();
        if (standard_id === 'gs1') {
            res.status(200);
            res.send({ connection_types: this.epcisOtJsonTranspiler.getConnectionTypes() });
        } else if (standard_id === 'wot') {
            res.status(200);
            res.send({ connection_types: this.wotOtJsonTranspiler.getConnectionTypes() });
        } else {
            res.status(400);
            res.send({
                message: 'Invalid type request',
            });
        }
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

    async _getDatasetInfo(request, response) {
        const datasetId = request.params.dataset_id;
        if (!datasetId) {
            response.status(400);
            response.send({
                message: 'Param dataset_id is required.',
            });
            return;
        }
        const dataInfo =
            await Models.data_info.findOne({ where: { data_set_id: datasetId } });

        if (!dataInfo) {
            this.logger.info(`Import data for data set ID ${datasetId} does not exist.`);
            response.status(404);
            response.send({
                message: `Import data for data set ID ${datasetId} does not exist`,
            });
            return;
        }

        const identity = await this.graphStorage.findIssuerIdentityForDatasetId(datasetId);

        if (!identity && identity.length > 0) {
            this.logger.info(`Issuer identity for data set ID ${datasetId} does not exist.`);
            response.status(404);
            response.send({
                message: `Import data for data set ID ${datasetId} does not exist`,
            });
            return;
        }

        const transactionHash = await ImportUtilities
            .getTransactionHash(datasetId, dataInfo.origin);

        const result = {
            dataset_id: datasetId,
            import_time: dataInfo.import_timestamp,
            dataset_size_in_bytes: dataInfo.data_size,
            otjson_size_in_bytes: dataInfo.otjson_size_in_bytes,
            root_hash: dataInfo.root_hash,
            data_hash: dataInfo.data_hash,
            total_graph_entities: dataInfo.total_documents,
            transaction_hash: transactionHash,
            blockchain_network: this.config.network.id,
            data_creator: {
                identifier_type: identity[0].identifierType,
                identifier_value: identity[0].identifierValue,
                validation_schema: identity[0].validationSchema,
            },

        };
        response.status(200);
        response.send(result);
    }
}


module.exports = RestAPIServiceV2;
