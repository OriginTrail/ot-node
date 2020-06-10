const fs = require('fs');
const ip = require('ip');
const restify = require('restify');
const corsMiddleware = require('restify-cors-middleware');

const Utilities = require('../Utilities');
const pjson = require('../../package.json');

const RestApiV2 = require('./rest-api-v2');

class RestApiController {
    constructor(ctx) {
        this.ctx = ctx;
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.apiUtilities = ctx.apiUtilities;
        this.emitter = ctx.emitter;
        this.infoController = ctx.infoController;
        this.version_id = 'controller';

        this.restApis = [new RestApiV2(ctx, true)];
        [this.defaultRestApi] = this.restApis;
    }

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

        const parseLatest = (req, res, next) => {
            req.url = req.url.replace(/(\/api\/)latest(\/.+)/, `$1${this.ctx.config.latest_api_version}$2`);
            next();
        };

        server.use(restify.plugins.acceptParser(server.acceptable));
        server.use(restify.plugins.queryParser());
        server.use(restify.plugins.bodyParser({
            maxBodySize: 10 * 1024 * 1024 * 1024,
            maxFileSize: 10 * 1024 * 1024 * 1024,
        }));
        server.pre(parseLatest);
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
            this.restApis.forEach(restApi => restApi._exposeAPIRoutes(server));
            this._exposeAPIRoutes(server);
        }
    }

    _exposeBootstrapAPIRoutes(server) {
        server.get('/api/info', async (req, res) => {
            await this.infoController.getNodeInfo(req, res);
        });
    }

    _exposeAPIRoutes(server) {
        server.get('/api/versions', async (req, res) => {
            const msg = [];
            this.restApis.forEach((restApi) => {
                msg.push(restApi.version_id);
                if (restApi.version_id === this.ctx.config.latest_api_version) {
                    msg.push(`latest: ${restApi.version_id}`);
                }
            });
            res.send({
                message: msg,
            });
        });
    }
}

module.exports = RestApiController;
