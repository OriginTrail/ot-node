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

        this.version_id = 'v2';

        if (ctx.config.latest_api_version === this.version_id) {
            this.version_id = 'latest';
        }
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
        if (req.body.importtype === undefined ||
            supportedImportTypes.indexOf(req.body.importtype) === -1) {
            res.status(400);
            res.send({
                message: 'Invalid import type',
            });
            return;
        }

        const importtype = req.body.importtype.toLowerCase();

        // Check if file is provided
        if (req.files !== undefined && req.files.importfile !== undefined) {
            const inputFile = req.files.importfile.path;
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
                    id: uuidv4(),
                    import_handle_id: 'e14bd51d-46d0',
                    data: JSON.stringify(object_to_import),
                    status: 'COMPLETED',
                });
                this.emitter.emit(`api-${importtype}-import-request`, queryObject);
            } catch (e) {
                res.status(400);
                res.send({
                    message: 'No import data provided',
                });
            }
        } else if (req.body.importfile !== undefined) {
            // Check if import data is provided in request body
            const queryObject = {
                content: req.body.importfile,
                contact: req.contact,
                replicate: req.body.replicate,
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
                id: uuidv4(),
                import_handle_id: 'e14bd51d-46d0',
                data: JSON.stringify(object_to_import),
                status: 'COMPLETED',
            });

            this.emitter.emit(`api-${importtype}-import-request`, queryObject);
        } else {
            // No import data provided
            res.status(400);
            res.send({
                message: 'No import data provided',
            });
        }
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

            console.log(res);
        });

        server.post(`/api/${this.version_id}/import/result/:import_handle`, async (req, res) => {
            const import_handle_object = await Models.import_handles.findOne({
                where: {
                    import_handle_id: 'e14bd51d-46d0',
                },
            });

            const { status } = import_handle_object;
            console.log(status);
        });
    }
}


module.exports = RestAPIServiceV2;
