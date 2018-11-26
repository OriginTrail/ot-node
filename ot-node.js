require('dotenv').config();

if (!process.env.NODE_ENV) {
    // Environment not set. Use the production.
    process.env.NODE_ENV = 'production';
}

const HttpNetwork = require('./modules/network/http/http-network');
const Kademlia = require('./modules/network/kademlia/kademlia');
const Transport = require('./modules/network/transport');
const KademliaUtilities = require('./modules/network/kademlia/kademlia-utils');
const Utilities = require('./modules/Utilities');
const GraphStorage = require('./modules/Database/GraphStorage');
const Blockchain = require('./modules/Blockchain');
const BlockchainPluginService = require('./modules/Blockchain/plugin/blockchain-plugin-service');
const restify = require('restify');
const fs = require('fs');
const path = require('path');
const models = require('./models');
const Storage = require('./modules/Storage');
const Importer = require('./modules/importer');
const GS1Importer = require('./modules/GS1Importer');
const GS1Utilities = require('./modules/GS1Utilities');
const WOTImporter = require('./modules/WOTImporter');
const Challenger = require('./modules/Challenger');
const RemoteControl = require('./modules/RemoteControl');
const corsMiddleware = require('restify-cors-middleware');
const bugsnag = require('bugsnag');
const rc = require('rc');
const mkdirp = require('mkdirp');
const uuidv4 = require('uuid/v4');
const awilix = require('awilix');
const homedir = require('os').homedir();
const ip = require('ip');
const argv = require('minimist')(process.argv.slice(2));

const Graph = require('./modules/Graph');
const Product = require('./modules/Product');

const EventEmitter = require('./modules/EventEmitter');
const DVService = require('./modules/DVService');
const MinerService = require('./modules/service/miner-service');
const ApprovalService = require('./modules/service/approval-service');
const ProfileService = require('./modules/service/profile-service');
const ReplicationService = require('./modules/service/replication-service');
const ImportController = require('./modules/controller/import-controller');
const RestAPIValidator = require('./modules/validator/rest-api-validator');
const APIUtilities = require('./modules/utility/api-utilities');

const pjson = require('./package.json');
const configjson = require('./config/config.json');

const Web3 = require('web3');

const log = require('./modules/logger');

global.__basedir = __dirname;

let context;
const defaultConfig = configjson[
    process.env.NODE_ENV &&
    ['development', 'staging', 'stable', 'mariner', 'production'].indexOf(process.env.NODE_ENV) >= 0 ?
        process.env.NODE_ENV : 'development'];

let config;
try {
    // Load config.
    config = rc(pjson.name, defaultConfig);

    if (argv.configDir) {
        config.appDataPath = argv.configDir;
        models.sequelize.options.storage = path.join(config.appDataPath, 'system.db');
    } else {
        config.appDataPath = path.join(
            homedir,
            `.${pjson.name}rc`,
            process.env.NODE_ENV,
        );
    }

    if (!config.node_wallet || !config.node_private_key) {
        console.error('Please provide valid wallet.');
        process.abort();
    }
} catch (error) {
    console.error(`Failed to read configuration. ${error}.`);
    console.error(error.stack);
    process.abort();
}

process.on('unhandledRejection', (reason, p) => {
    if (reason.message.startsWith('Invalid JSON RPC response')) {
        return;
    }
    log.error(`Unhandled Rejection:\n${reason.stack}`);

    if (process.env.NODE_ENV !== 'development') {
        const cleanConfig = Object.assign({}, config);
        delete cleanConfig.node_private_key;
        delete cleanConfig.houston_password;
        delete cleanConfig.database;
        delete cleanConfig.blockchain;

        bugsnag.notify(
            reason,
            {
                user: {
                    id: config.node_wallet,
                    identity: config.identity,
                    config: cleanConfig,
                },
                severity: 'error',
            },
        );
    }
});

process.on('uncaughtException', (err) => {
    if (process.env.NODE_ENV === 'development') {
        log.error(`Caught exception: ${err}.\n ${err.stack}`);
        process.exit(1);
    }
    log.error(`Caught exception: ${err}.\n ${err.stack}`);

    const cleanConfig = Object.assign({}, config);
    delete cleanConfig.node_private_key;
    delete cleanConfig.houston_password;
    delete cleanConfig.database;
    delete cleanConfig.blockchain;

    bugsnag.notify(
        err,
        {
            user: {
                id: config.node_wallet,
                identity: config.identity,
                config: cleanConfig,
            },
            severity: 'error',
        },
    );
});

process.on('warning', (warning) => {
    log.warn(warning.name);
    log.warn(warning.message);
    log.warn(warning.stack);
});

process.on('exit', (code) => {
    if (code !== 0) {
        log.error(`Whoops, terminating with code: ${code}`);
    } else {
        log.debug(`Normal exiting with code: ${code}`);
    }
});

process.on('SIGINT', () => {
    log.important('SIGINT caught. Exiting...');
    process.exit(0);
});

function notifyBugsnag(error, metadata, subsystem) {
    if (process.env.NODE_ENV !== 'development') {
        const cleanConfig = Object.assign({}, config);
        delete cleanConfig.node_private_key;
        delete cleanConfig.houston_password;
        delete cleanConfig.database;
        delete cleanConfig.blockchain;

        const options = {
            user: {
                id: config.node_wallet,
                identity: config.node_kademlia_id,
                config: cleanConfig,
            },
        };

        if (subsystem) {
            options.subsystem = {
                name: subsystem,
            };
        }

        if (metadata) {
            Object.assign(options, metadata);
        }

        bugsnag.notify(error, options);
    }
}

function notifyEvent(message, metadata, subsystem) {
    if (process.env.NODE_ENV !== 'development') {
        const cleanConfig = Object.assign({}, config);
        delete cleanConfig.node_private_key;
        delete cleanConfig.houston_password;
        delete cleanConfig.database;
        delete cleanConfig.blockchain;

        const options = {
            user: {
                id: config.node_wallet,
                identity: config.node_kademlia_id,
                config: cleanConfig,
            },
            severity: 'info',
        };

        if (subsystem) {
            options.subsystem = {
                name: subsystem,
            };
        }

        if (metadata) {
            Object.assign(options, metadata);
        }

        bugsnag.notify(message, options);
    }
}

/**
 * Main node object
 */
class OTNode {
    /**
     * OriginTrail node system bootstrap function
     */
    async bootstrap() {
        if (process.env.NODE_ENV !== 'development') {
            bugsnag.register(
                pjson.config.bugsnagkey,
                {
                    appVersion: pjson.version,
                    autoNotify: false,
                    sendCode: true,
                    releaseStage: config.bugSnag.releaseStage,
                    logger: {
                        info: log.info,
                        warn: log.warn,
                        error: log.error,
                    },
                    logLevel: 'error',
                },
            );
        }

        try {
            // check if all dependencies are installed
            await Utilities.checkInstalledDependencies();
            log.info('npm modules dependencies check done');

            // Checking root folder structure
            Utilities.checkOtNodeDirStructure();
            log.info('ot-node folder structure check done');
        } catch (err) {
            console.log(err);
            notifyBugsnag(err);
            process.exit(1);
        }

        log.important(`Running in ${process.env.NODE_ENV} environment.`);

        // sync models
        try {
            Storage.models = (await models.sequelize.sync()).models;
            Storage.db = models.sequelize;
        } catch (error) {
            if (error.constructor.name === 'ConnectionError') {
                console.error('Failed to open database. Did you forget to run "npm run setup"?');
                process.abort();
            }
            console.error(error);
            process.abort();
        }

        // Seal config in order to prevent adding properties.
        // Allow identity to be added. Continuity.
        config.identity = '';
        config.erc725Identity = '';
        Object.seal(config);

        // check for Updates
        try {
            log.info('Checking for updates');
            await Utilities.checkForUpdates(config.autoUpdater);
        } catch (err) {
            console.log(err);
            notifyBugsnag(err);
            process.exit(1);
        }

        const web3 =
            new Web3(new Web3.providers.HttpProvider(`${config.blockchain.rpc_node_host}:${config.blockchain.rpc_node_port}`));

        const appState = {};
        if (config.is_bootstrap_node) {
            await this.startBootstrapNode({ appState }, web3);
            return;
        }

        // check if ArangoDB service is running at all
        if (config.database.provider === 'arangodb') {
            try {
                const responseFromArango = await Utilities.getArangoDbVersion(config);
                log.info(`Arango server version ${responseFromArango.version} is up and running`);
            } catch (err) {
                log.error('Please make sure Arango server is up and running');
                console.log(err);
                notifyBugsnag(err);
                process.exit(1);
            }
        }

        // Checking if selected graph database exists
        try {
            await Utilities.checkDoesStorageDbExists(config);
            log.info('Storage database check done');
        } catch (err) {
            console.log(err);
            notifyBugsnag(err);
            process.exit(1);
        }

        // Create the container and set the injectionMode to PROXY (which is also the default).
        const container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });

        context = container.cradle;

        container.loadModules(['modules/command/**/*.js', 'modules/controller/**/*.js', 'modules/service/**/*.js', 'modules/Blockchain/plugin/hyperledger/*.js'], {
            formatName: 'camelCase',
            resolverOptions: {
                lifetime: awilix.Lifetime.SINGLETON,
                register: awilix.asClass,
            },
        });

        container.register({
            httpNetwork: awilix.asClass(HttpNetwork).singleton(),
            emitter: awilix.asClass(EventEmitter).singleton(),
            kademlia: awilix.asClass(Kademlia).singleton(),
            graph: awilix.asClass(Graph).singleton(),
            product: awilix.asClass(Product).singleton(),
            dvService: awilix.asClass(DVService).singleton(),
            profileService: awilix.asClass(ProfileService).singleton(),
            approvalService: awilix.asClass(ApprovalService).singleton(),
            config: awilix.asValue(config),
            appState: awilix.asValue(appState),
            web3: awilix.asValue(web3),
            importer: awilix.asClass(Importer).singleton(),
            blockchain: awilix.asClass(Blockchain).singleton(),
            blockchainPluginService: awilix.asClass(BlockchainPluginService).singleton(),
            gs1Importer: awilix.asClass(GS1Importer).singleton(),
            gs1Utilities: awilix.asClass(GS1Utilities).singleton(),
            wotImporter: awilix.asClass(WOTImporter).singleton(),
            graphStorage: awilix.asValue(new GraphStorage(config.database, log)),
            remoteControl: awilix.asClass(RemoteControl).singleton(),
            challenger: awilix.asClass(Challenger).singleton(),
            logger: awilix.asValue(log),
            kademliaUtilities: awilix.asClass(KademliaUtilities).singleton(),
            notifyError: awilix.asFunction(() => notifyBugsnag).transient(),
            notifyEvent: awilix.asFunction(() => notifyEvent).transient(),
            transport: awilix.asValue(Transport()),
            apiUtilities: awilix.asClass(APIUtilities).singleton(),
            importController: awilix.asClass(ImportController).singleton(),
            minerService: awilix.asClass(MinerService).singleton(),
            replicationService: awilix.asClass(ReplicationService).singleton(),
        });
        const blockchain = container.resolve('blockchain');
        await blockchain.initialize();

        const emitter = container.resolve('emitter');
        const dhService = container.resolve('dhService');
        const remoteControl = container.resolve('remoteControl');
        const profileService = container.resolve('profileService');
        const approvalService = container.resolve('approvalService');
        await approvalService.initialize();

        emitter.initialize();

        // check does node_wallet has sufficient funds
        try {
            appState.enoughFunds = await blockchain.hasEnoughFunds();
            const identityFilePath = path.join(
                config.appDataPath,
                config.erc725_identity_filepath,
            );
            // If ERC725 exist assume profile is created. No need to check for the funds
            if (!fs.existsSync(identityFilePath)) {
                // Profile does not exists. Check if we have enough funds.
                appState.enoughFunds = await blockchain.hasEnoughFunds();
                if (!appState.enoughFunds) {
                    log.warn('Insufficient funds to create profile');
                    process.exit(1);
                }
            }
        } catch (err) {
            notifyBugsnag(err);
            log.error(`Failed to check for funds. ${err.message}.`);
            process.exit(1);
        }
        setInterval(async () => {
            try {
                appState.enoughFunds = await blockchain.hasEnoughFunds();
            } catch (err) {
                notifyBugsnag(err);
            }
        }, 1800000);

        // Connecting to graph database
        const graphStorage = container.resolve('graphStorage');
        try {
            await graphStorage.connect();
            log.info(`Connected to graph database: ${graphStorage.identify()}`);
            // TODO https://www.pivotaltracker.com/story/show/157873617
            // const myVersion = await graphStorage.version();
            // log.info(`Database version: ${myVersion}`);
        } catch (err) {
            log.error(`Failed to connect to the graph database: ${graphStorage.identify()}`);
            console.log(err);
            notifyBugsnag(err);
            process.exit(1);
        }

        // Fetch Houston access password
        if (!config.houston_password) {
            config.houston_password = uuidv4();
        }

        fs.writeFileSync(path.join(config.appDataPath, 'houston.txt'), config.houston_password);
        log.notify('================================================================');
        log.notify('Houston password stored in file                                 ');
        log.notify('================================================================');

        // Starting the kademlia
        const transport = container.resolve('transport');
        await transport.init(container.cradle);

        // Starting event listener on Blockchain
        this.listenBlockchainEvents(blockchain);
        dhService.listenToBlockchainEvents();

        try {
            await profileService.initProfile();
        } catch (e) {
            log.error('Failed to create profile');
            console.log(e);
            notifyBugsnag(e);
            process.exit(1);
        }
        await transport.start();

        // Check if ERC725 has valid node ID.
        const profile = await blockchain.getProfile(config.erc725Identity);

        if (!profile.nodeId.toLowerCase().startsWith(`0x${config.identity.toLowerCase()}`)) {
            throw Error('ERC725 profile not created for this node ID. ' +
                `My identity ${config.identity}, profile's node id: ${profile.nodeId}.`);
        }

        // Initialise API
        const apiUtilities = container.resolve('apiUtilities');
        await this.startRPC(apiUtilities);

        if (config.remote_control_enabled) {
            log.info(`Remote control enabled and listening on port ${config.node_remote_control_port}`);
            await remoteControl.connect();
        }

        const commandExecutor = container.resolve('commandExecutor');
        await commandExecutor.init();
        await commandExecutor.replay();
        await commandExecutor.start();
        appState.started = true;
    }

    /**
     * Starts bootstrap node
     * @return {Promise<void>}
     */
    async startBootstrapNode({ appState }, web3) {
        const container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });

        container.loadModules(['modules/Blockchain/plugin/hyperledger/*.js'], {
            formatName: 'camelCase',
            resolverOptions: {
                lifetime: awilix.Lifetime.SINGLETON,
                register: awilix.asClass,
            },
        });

        container.register({
            emitter: awilix.asValue({}),
            web3: awilix.asValue(web3),
            blockchain: awilix.asClass(Blockchain).singleton(),
            blockchainPluginService: awilix.asClass(BlockchainPluginService).singleton(),
            approvalService: awilix.asClass(ApprovalService).singleton(),
            kademlia: awilix.asClass(Kademlia).singleton(),
            config: awilix.asValue(config),
            appState: awilix.asValue(appState),
            remoteControl: awilix.asClass(RemoteControl).singleton(),
            logger: awilix.asValue(log),
            kademliaUtilities: awilix.asClass(KademliaUtilities).singleton(),
            notifyError: awilix.asFunction(() => notifyBugsnag).transient(),
            transport: awilix.asValue(Transport()),
            apiUtilities: awilix.asClass(APIUtilities).singleton(),
        });

        const transport = container.resolve('transport');
        await transport.init(container.cradle);
        await transport.start();

        const blockchain = container.resolve('blockchain');
        await blockchain.initialize();

        const approvalService = container.resolve('approvalService');
        await approvalService.initialize();

        this.listenBlockchainEvents(blockchain);
        blockchain.subscribeToEventPermanentWithCallback([
            'NodeApproved',
            'NodeRemoved',
        ], (eventData) => {
            approvalService.handleApprovalEvent(eventData);
        });

        const apiUtilities = container.resolve('apiUtilities');
        await this.startRPC(apiUtilities);
    }

    /**
     * Listen to all Bidding events
     * @param blockchain
     */
    listenBlockchainEvents(blockchain) {
        log.info('Starting blockchain event listener');

        const delay = 10000;
        let working = false;
        let deadline = Date.now();
        setInterval(() => {
            if (!working && Date.now() > deadline) {
                working = true;
                blockchain.getAllPastEvents('HOLDING_CONTRACT');
                blockchain.getAllPastEvents('PROFILE_CONTRACT');
                blockchain.getAllPastEvents('APPROVAL_CONTRACT');
                deadline = Date.now() + delay;
                working = false;
            }
        }, 5000);
    }

    /**
     * Start RPC server
     * @param apiUtilities - API utilities instance
     */
    async startRPC(apiUtilities) {
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

        if (config.node_rpc_use_ssl) {
            Object.assign(options, {
                key: fs.readFileSync(config.node_rpc_ssl_key_path),
                certificate: fs.readFileSync(config.node_rpc_ssl_cert_path),
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
            const result = apiUtilities.authorize(request);
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
        let serverListenAddress = config.node_rpc_ip;
        if (ip.isLoopback(serverListenAddress)) {
            serverListenAddress = '0.0.0.0';
        }

        // promisified server.listen()
        const startServer = () => new Promise((resolve, reject) => {
            server.listen(config.node_rpc_port, serverListenAddress, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        try {
            await startServer(server, serverListenAddress);
            log.notify(`API exposed at  ${server.url}`);
        } catch (err) {
            log.error('Failed to start RPC server');
            console.log(err);
            notifyBugsnag(err);
            process.exit(1);
        }

        if (!config.is_bootstrap_node) {
            // register API routes only if the node is not bootstrap
            this.exposeAPIRoutes(server, context);
        }
    }

    /**
     * API Routes
     */
    exposeAPIRoutes(server, ctx) {
        const {
            emitter, importController, apiUtilities, dcController,
        } = ctx;

        /**
         * Data import route
         * @param importfile - file or text data
         * @param importtype - (GS1/WOT)
         */
        server.post('/api/import', async (req, res) => {
            await importController.import(req, res);
        });

        /**
         * Create offer route
         */
        server.post('/api/replication', async (req, res) => {
            await dcController.createOffer(req, res);
        });

        server.get('/api/dump/rt', (req, res) => {
            log.api('Dumping routing table');
            const message = context.transport.dumpContacts();

            res.status(200);
            res.send({
                message,
            });
        });

        server.get('/api/network/get-contact/:node_id', async (req, res) => {
            const nodeId = req.params.node_id;
            log.api(`Get contact node ID ${nodeId}`);

            const result = await context.transport.getContact(nodeId);
            const body = {};

            if (result) {
                Object.assign(body, result);
            }
            res.status(200);
            res.send(body);
        });

        server.get('/api/network/find/:node_id', async (req, res) => {
            const nodeId = req.params.node_id;
            log.api(`Find node ID ${nodeId}`);

            const result = await context.transport.findNode(nodeId);
            const body = {};

            if (result) {
                Object.assign(body, result);
            }
            res.status(200);
            res.send(body);
        });

        server.get('/api/replication/:replication_id', (req, res) => {
            log.api('GET: Replication status request received');

            const replicationId = req.params.replication_id;
            if (replicationId == null) {
                log.error('Invalid request. You need to provide replication ID');
                res.status = 400;
                res.send({
                    message: 'Replication ID is not provided',
                });
            } else {
                const queryObject = {
                    replicationId,
                    response: res,
                };
                emitter.emit('api-offer-status', queryObject);
            }
        });

        /**
         * Get trail from database
         * @param QueryObject - ex. {uid: abc:123}
         */
        server.get('/api/trail', (req, res, next) => {
            log.api('GET: Trail request received.');

            const error = RestAPIValidator.validateNotEmptyQuery(req.query);
            if (error) {
                return next(error);
            }
            const queryObject = req.query;
            emitter.emit('api-trail', {
                query: queryObject,
                response: res,
            });
        });

        /** Get root hash for provided data query
         * @param Query params: data_set_id
         */
        server.get('/api/fingerprint', (req, res) => {
            log.api('GET: Fingerprint request received.');

            const queryObject = req.query;
            emitter.emit('api-get_root_hash', {
                query: queryObject,
                response: res,
            });
        });

        server.get('/api/query/network/:query_id', (req, res) => {
            log.api('GET: Query for status request received.');

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

        server.get('/api/query/:query_id/responses', (req, res) => {
            log.api('GET: Local query responses request received.');

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

        server.post('/api/query/network', (req, res, next) => {
            log.api('POST: Network query request received.');

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

        /**
         * Get vertices by query
         * @param queryObject
         */
        server.post('/api/query/local', (req, res, next) => {
            log.api('POST: Local query request received.');

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

        server.get('/api/query/local/import/:data_set_id', (req, res) => {
            log.api('GET: Local import request received.');

            if (!req.params.data_set_id) {
                res.status(400);
                res.send({
                    message: 'Param required.',
                });
                return;
            }

            emitter.emit('api-query-local-import', {
                data_set_id: req.params.data_set_id,
                request: req,
                response: res,
            });
        });

        server.post('/api/read/network', (req, res) => {
            log.api('POST: Network read request received.');

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


        server.post('/api/deposit', (req, res) => {
            log.api('POST: Deposit tokens request received.');

            if (req.body !== null && typeof req.body.trac_amount === 'number'
                && req.body.trac_amount > 0) {
                const { trac_amount } = req.body;
                emitter.emit('api-deposit-tokens', {
                    trac_amount,
                    response: res,
                });
            } else {
                res.status(400);
                res.send({ message: 'Bad request' });
            }
        });


        server.post('/api/withdraw', (req, res) => {
            log.api('POST: Withdraw tokens request received.');

            if (req.body !== null && typeof req.body.trac_amount === 'number'
                && req.body.trac_amount > 0) {
                const { trac_amount } = req.body;
                emitter.emit('api-withdraw-tokens', {
                    trac_amount,
                    response: res,
                });
            } else {
                res.status(400);
                res.send({ message: 'Bad request' });
            }
        });

        server.get('/api/import_info', async (req, res) => {
            await importController.dataSetInfo(req, res);
        });

        server.get('/api/imports_info', (req, res) => {
            log.api('GET: List imports request received.');

            emitter.emit('api-imports-info', {
                response: res,
            });
        });

        server.get('/api/consensus/:sender_id', (req, res) => {
            log.api('GET: Consensus check events request received.');

            if (req.params.sender_id == null) {
                res.status(400);
                res.send({ message: 'Bad request' });
            }

            emitter.emit('api-consensus-events', {
                sender_id: req.params.sender_id,
                response: res,
            });
        });

        server.get('/api/info', (req, res) => {
            log.api('GET: Node information request received.');

            emitter.emit('api-node-info', {
                response: res,
            });
        });

        /**
         * Temporary route used for HTTP network prototype
         */
        server.post('/network/send', (req, res) => {
            log.api('P2P request received');

            const { type } = req.body;
            emitter.emit(type, req, res);
        });
    }
}


console.log(' ██████╗ ████████╗███╗   ██╗ ██████╗ ██████╗ ███████╗');
console.log('██╔═══██╗╚══██╔══╝████╗  ██║██╔═══██╗██╔══██╗██╔════╝');
console.log('██║   ██║   ██║   ██╔██╗ ██║██║   ██║██║  ██║█████╗');
console.log('██║   ██║   ██║   ██║╚██╗██║██║   ██║██║  ██║██╔══╝');
console.log('╚██████╔╝   ██║   ██║ ╚████║╚██████╔╝██████╔╝███████╗');
console.log(' ╚═════╝    ╚═╝   ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚══════╝');

console.log('======================================================');
console.log(`             OriginTrail Node v${pjson.version}`);
console.log('======================================================');
console.log('');

const otNode = new OTNode();
otNode.bootstrap().then(() => {
    log.info('OT Node started');
});
