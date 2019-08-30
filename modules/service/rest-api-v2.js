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
        this.stanards = ['OT-JSON', 'GS1-EPCIS'];

        this.mapping_standards_for_event = new Map();
        this.mapping_standards_for_event.set('ot-json', 'graph');
        this.mapping_standards_for_event.set('gs1-epcis', 'gs1');
    }

    /**
     * Start RPC server
     */
    async startRPC() {
        const options = {
            name: 'RPC server',
            version: pjson.version,
            formatters: {
                'application/json': (req, res, body) => {
                    res.set('content-type', 'application/json; charset=utf-8');
                    if (!body) {
                        if (res.getHeader('Content-Length') === undefined && res.contentLength === undefined) {
                            res.setHeader('Content-Length', 0);
                        }
                        return null;
                    }

                    if (body instanceof Error) {
                        // snoop for RestError or HttpError, but don't rely on instanceof
                        if ((body.restCode || body.httpCode) && body.body) {
                            // eslint-disable-next-line
                            body = body.body;
                        } else {
                            body = {
                                message: body.message,
                            };
                        }
                    }

                    if (Buffer.isBuffer(body)) {
                        body = body.toString('base64');
                    }

                    let ident = 2;
                    if ('prettify-json' in req.headers) {
                        if (req.headers['prettify-json'] === 'false') {
                            ident = 0;
                        }
                    }
                    const data = Utilities.stringify(body, ident);

                    if (res.getHeader('Content-Length') === undefined && res.contentLength === undefined) {
                        res.setHeader('Content-Length', Buffer.byteLength(data));
                    }
                    return data;
                },
            },
        };

        if (this.config.node_rpc_use_ssl) {
            Object.assign(options, {
                key: fs.readFileSync(this.config.node_rpc_ssl_key_path),
                certificate: fs.readFileSync(this.config.node_rpc_ssl_cert_path),
                rejectUnauthorized: true,
            });
        }

        const server = restify.createServer(options);

        server.use(restify.plugins.acceptParser(server.acceptable));
        server.use(restify.plugins.queryParser());
        server.use(restify.plugins.bodyParser());
        const cors = corsMiddleware({
            preflightMaxAge: 5, // Optional
            origins: ['*'],
            allowHeaders: ['API-Token', 'prettify-json', 'raw-data'],
            exposeHeaders: ['API-Token-Expiry'],
        });

        server.pre(cors.preflight);
        server.use(cors.actual);
        server.use((request, response, next) => {
            const result = this.apiUtilities.authorize(request);
            if (result) {
                response.status(result.status);
                response.send({
                    message: result.message,
                });
                return;
            }
            return next();
        });

        // TODO: Temp solution to listen all adapters in local net.
        let serverListenAddress = this.config.node_rpc_ip;
        if (ip.isLoopback(serverListenAddress)) {
            serverListenAddress = '0.0.0.0';
        }

        // promisified server.listen()
        const startServer = () => new Promise((resolve, reject) => {
            server.listen(this.config.node_rpc_port, serverListenAddress, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        await startServer(server, serverListenAddress);
        this.logger.notify(`API exposed at  ${server.url}`);

        if (this.config.is_bootstrap_node) {
            this._exposeBootstrapAPIRoutes(server);
        } else {
            this._exposeAPIRoutes(server);
        }
    }

    async _handler_check_existance(req, res) {
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
    async _import_v2(req, res) {
        this.logger.api('POST: Import of data request received.');

        if (req.body === undefined) {
            res.status(400);
            res.send({
                message: 'Bad request',
            });
            return;
        }

        const supportedImportTypes = ['GS1-EPCIS', 'OT-JSON'];

        // Check if import type is valid
        if (req.body.standard_id === undefined ||
            supportedImportTypes.indexOf(req.body.standard_id) === -1) {
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
                    replicate: req.body.replicate,
                    response: res,
                };

                /**
                 * dodaje se jedan podatak u bazu, da bi se kasnije testiralo da li je proso import
                 */
                // const object_to_import =
                //     {
                //         dataset_id: '0x123abc',
                //         import_time: 1565884857,
                //         dataset_size_in_bytes: 16384,
                //         otjson_size_in_bytes: 12144,
                //         root_hash: '0xAB13C',
                //         data_hash: '0xBB34C',
                //         total_graph_entities: 15,
                //     };
                //
                //
                const inserted_object = await Models.handler_ids.create({
                    status: 'PENDING',
                });

                this.emitter.emit(`api-${this.mapping_standards_for_event.get(standard_id)}-import-request`, queryObject);

                const { handler_id } = inserted_object.dataValues;
                res.status(200);
                res.send({
                    import_handle: handler_id,
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
                // replicate: req.body.replicate,
                response: res,
            };

            /**
             * dodaje se jedan podatak u bazu, da bi se kasnije testiralo da li je proso import
             */

            const object_to_import =
                {
                    dataset_id: '0x123abc',
                    import_time: 1565884857,
                    dataset_size_in_bytes: 16384,
                    otjson_size_in_bytes: 12144,
                    root_hash: '0xAB13C',
                    data_hash: '0xBB34C',
                    total_graph_entities: 15,
                };


            await Models.import_handles.create({
                data: JSON.stringify(object_to_import),
                status: 'COMPLETED',
            });

            const inserted_object = this.emitter.emit(`api-${standard_id}-import-request`, queryObject);

            const { import_handle_id } = inserted_object.dataValues;
            res.status(200);
            res.send({
                import_handle: import_handle_id,
            });
        } else {
            // No import data provided
            res.status(400);
            res.send({
                message: 'No import data provided',
            });
        }
    }

    async _createOffer(req, res) {
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
            // if (dataset == null) {
            //     this.logger.info('Invalid request');
            //     res.status(404);
            //     res.send({
            //         message: 'This data set does not exist in the database',
            //     });
            //     return;
            // }
            //
            // const queryObject = {
            //     dataSetId: req.body.dataset_id,
            //     data_lifespan: req.body.data_lifespan,
            //     total_token_amount: req.body.total_token_amount,
            //     response: res,
            // };

            const object_to_import =
                {
                    dataset_id: '0x123abc',
                    import_time: 1565884857,
                    dataset_size_in_bytes: 16384,
                    otjson_size_in_bytes: 12144,
                    root_hash: '0xAB13C',
                    data_hash: '0xBB34C',
                    total_graph_entities: 15,
                };


            const inserted_object = await Models.handler_ids.create({
                data: JSON.stringify(object_to_import),
                status: 'COMPLETED',
            });
            const QueryObject = {
                response: res,
                handler_id: inserted_object.dataValues.handler_id,
            };

            this.emitter.emit('api-create-offer-v2', QueryObject);
        } else {
            this.logger.error('Invalid request');
            res.status(400);
            res.send({
                message: 'Invalid parameters!',
            });
        }
    }

    async _export_v2(req, res) {
        this.logger.api('POST: Export of data request received.');

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
                message: 'Invalid import type or unsupported standard',
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

        // if (requested_dataset === undefined) {
        //     res.status(400);
        //     res.send({
        //         message: 'Data set does not exist',
        //     });
        // }

        // const { dataset_id } = requested_dataset;

        const object_to_import =
            {
                dataset_id: '0x123abc',
                import_time: 1565884857,
                dataset_size_in_bytes: 16384,
                otjson_size_in_bytes: 12144,
                root_hash: '0xAB13C',
                data_hash: '0xBB34C',
                total_graph_entities: 15,
            };

        const inserted_object = await Models.handler_ids.create({
            data: JSON.stringify(object_to_import),
            status: 'COMPLETED',
        });

        const { handler_id } = inserted_object.dataValues;
        res.status(200);
        res.send({
            import_handle: handler_id,
        });
    }
    /**
     * API Routes
     */
    _exposeAPIRoutes(server) {
        const {
            importController, dcController, transport, emitter,
            blockchain, web3, config,
        } = this.ctx;

        server.post(`/api/${this.version_id}/import`, async (req, res) => {
            await this._import_v2(req, res);
        });

        server.get(`/api/${this.version_id}/import/result/:handler_id`, async (req, res) => {
            await this._handler_check_existance(req, res);
        });

        server.post(`/api/${this.version_id}/replicate`, async (req, res) => {
            await this._createOffer(req, res);
        });

        server.get(`/api/${this.version_id}/replicate/result/:handler_id`, async (req, res) => {
            await this._handler_check_existance(req, res);
        });

        server.post(`/api/${this.version_id}/export`, async (req, res) => {
            await this._export_v2(req, res);
            /**
             * ovde ce da dodje docin eksporter
             */
        });

        server.get(`/api/${this.version_id}/export/result/:handler_id`, async (req, res) => {
            await this._handler_check_existance(req, res);
        });

        server.get(`/api/${this.version_id}/standards`, async (req, res) => {
            let msg = '';
            this.stanards.forEach(standard =>
                msg += `${standard},   `);

            res.send({
                message: msg,
            });
        });
    }
}


module.exports = RestAPIServiceV2;
