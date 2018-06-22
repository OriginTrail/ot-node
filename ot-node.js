const Network = require('./modules/Network');
const NetworkUtilities = require('./modules/NetworkUtilities');
const Utilities = require('./modules/Utilities');
const GraphStorage = require('./modules/Database/GraphStorage');
const Blockchain = require('./modules/Blockchain');
const restify = require('restify');
const fs = require('fs');
const models = require('./models');
const Storage = require('./modules/Storage');
const Importer = require('./modules/importer');
const GS1Importer = require('./modules/GS1Importer');
const GS1Utilities = require('./modules/GS1Utilities');
const WOTImporter = require('./modules/WOTImporter');
const config = require('./modules/Config');
const Challenger = require('./modules/Challenger');
const RemoteControl = require('./modules/RemoteControl');
const corsMiddleware = require('restify-cors-middleware');

const awilix = require('awilix');

const Graph = require('./modules/Graph');
const Product = require('./modules/Product');

const EventEmitter = require('./modules/EventEmitter');
const DCService = require('./modules/DCService');
const DHService = require('./modules/DHService');
const DVService = require('./modules/DVService');
const DataReplication = require('./modules/DataReplication');

const pjson = require('./package.json');

const log = Utilities.getLogger();
const Web3 = require('web3');

process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
    // application specific logging, throwing an error, or other logic here
});

/**
 * Main node object
 */
class OTNode {
    /**
     * OriginTrail node system bootstrap function
     */
    async bootstrap() {
        try {
            // check if all dependencies are installed
            await Utilities.checkInstalledDependencies();
            log.info('npm modules dependences check done');

            // Checking root folder stucture
            Utilities.checkOtNodeDirStructure();
            log.info('ot-node folder structure check done');
        } catch (err) {
            console.log(err);
            process.exit(1);
        }

        // check if ArangoDB service is running at all
        if (process.env.GRAPH_DATABASE === 'arangodb') {
            try {
                const responseFromArango = await Utilities.getArangoDbVersion();
                log.info(`Arango server version ${responseFromArango.version} is up and running`);
            } catch (err) {
                process.exit(1);
            }
        }

        // sync models
        Storage.models = (await models.sequelize.sync()).models;
        Storage.db = models.sequelize;

        // Loading config data
        try {
            await Utilities.loadConfig();
            log.info('Loaded system config');
        } catch (err) {
            console.log(err);
            process.exit(1);
        }

        let selectedDatabase;
        // Loading selected graph database data
        try {
            selectedDatabase = await Utilities.loadSelectedDatabaseInfo();
            log.info('Loaded selected database data');
            config.database = selectedDatabase;
        } catch (err) {
            console.log(err);
            process.exit(1);
        }

        // Checking if selected graph database exists
        try {
            await Utilities.checkDoesStorageDbExists();
            log.info('Storage database check done');
        } catch (err) {
            console.log(err);
            process.exit(1);
        }

        let selectedBlockchain;
        // Loading selected blockchain network
        try {
            selectedBlockchain = await Utilities.loadSelectedBlockchainInfo();
            log.info(`Loaded selected blockchain network ${selectedBlockchain.blockchain_title}`);
            config.blockchain = selectedBlockchain;
        } catch (err) {
            console.log(err);
            process.exit(1);
        }

        const web3 =
            new Web3(new Web3.providers.HttpProvider(`${config.blockchain.rpc_node_host}:${config.blockchain.rpc_node_port}`));

        // check does node_wallet has sufficient Ether and ATRAC tokens
        if (process.env.NODE_ENV !== 'test') {
            try {
                const etherBalance = await Utilities.getBalanceInEthers();
                if (etherBalance <= 0) {
                    console.log('Please get some ETH in the node wallet before running ot-node');
                    process.exit(1);
                } else {
                    (
                        log.info(`Initial balance of ETH: ${etherBalance}`)
                    );
                }

                const atracBalance = await Utilities.getAlphaTracTokenBalance();
                if (atracBalance <= 0) {
                    console.log('Please get some ATRAC in the node wallet before running ot-node');
                    process.exit(1);
                } else {
                    (
                        log.info(`Initial balance of ATRAC: ${atracBalance}`)
                    );
                }
            } catch (error) {
                console.log(error);
            }
        }

        // Create the container and set the injectionMode to PROXY (which is also the default).
        const container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });

        container.register({
            emitter: awilix.asClass(EventEmitter).singleton(),
            network: awilix.asClass(Network).singleton(),
            graph: awilix.asClass(Graph).singleton(),
            product: awilix.asClass(Product).singleton(),
            dhService: awilix.asClass(DHService).singleton(),
            dcService: awilix.asClass(DCService).singleton(),
            dvService: awilix.asClass(DVService).singleton(),
            config: awilix.asValue(config),
            web3: awilix.asValue(web3),
            importer: awilix.asClass(Importer).singleton(),
            blockchain: awilix.asClass(Blockchain).singleton(),
            dataReplication: awilix.asClass(DataReplication).singleton(),
            gs1Importer: awilix.asClass(GS1Importer).singleton(),
            gs1Utilities: awilix.asClass(GS1Utilities).singleton(),
            wotImporter: awilix.asClass(WOTImporter).singleton(),
            graphStorage: awilix.asValue(new GraphStorage(selectedDatabase, log)),
            remoteControl: awilix.asClass(RemoteControl).singleton(),
            challenger: awilix.asClass(Challenger).singleton(),
            logger: awilix.asValue(log),
            networkUtilities: awilix.asClass(NetworkUtilities).singleton(),
        });
        const emitter = container.resolve('emitter');
        const dhService = container.resolve('dhService');
        const remoteControl = container.resolve('remoteControl');
        emitter.initialize();

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
            process.exit(1);
        }

        // Initialise API
        this.startRPC(emitter);

        // Starting the kademlia
        const network = container.resolve('network');
        const blockchain = container.resolve('blockchain');

        await network.initialize();
        await blockchain.initialize();


        // Starting event listener on Blockchain
        this.listenBlockchainEvents(blockchain);
        dhService.listenToBlockchainEvents();

        try {
            await this.createProfile(blockchain);
        } catch (e) {
            log.error('Failed to create profile');
            console.log(e);
            process.exit(1);
        }

        await network.start();

        if (parseInt(config.remote_control_enabled, 10)) {
            log.info(`Remote control enabled and listening on port ${config.remote_control_port}`);
            await remoteControl.connect();
        }
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
                blockchain.getAllPastEvents('BIDDING_CONTRACT');
                blockchain.getAllPastEvents('READING_CONTRACT');
                blockchain.getAllPastEvents('ESCROW_CONTRACT');
                deadline = Date.now() + delay;
                working = false;
            }
        }, 1000);
    }

    /**
     * Creates profile on the contract
     */
    async createProfile(blockchain) {
        const { identity } = config;
        const profileInfo = await blockchain.getProfile(config.node_wallet);
        if (profileInfo.active) {
            log.info(`Profile has already been created for ${identity}`);
            return;
        }

        log.notify(`Profile is being created for ${identity}. This could take a while...`);
        await blockchain.createProfile(
            config.identity,
            config.dh_price,
            config.dh_stake_factor,
            config.read_stake_factor,
            config.dh_max_time_mins,
        );
        const event = await blockchain.subscribeToEvent('ProfileCreated', null, 5 * 60 * 1000, null, (eventData) => {
            if (eventData.node_id) {
                return eventData.node_id.includes(identity);
            }
            return false;
        });
        if (event) {
            log.notify(`Profile created for node ${identity}`);
        } else {
            log.error('Profile could not be confirmed in timely manner. Please, try again later.');
            process.exit(1);
        }
    }

    /**
     * Start RPC server
     */
    startRPC(emitter) {
        const server = restify.createServer({
            name: 'RPC server',
            version: pjson.version,
            formatters: {
                'application/json': (req, res, body) => {
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

                    const data = JSON.stringify(body, null, 2);
                    if (res.getHeader('Content-Length') === undefined && res.contentLength === undefined) {
                        res.setHeader('Content-Length', Buffer.byteLength(data));
                    }
                    return data;
                },
            },
        });

        server.use(restify.plugins.acceptParser(server.acceptable));
        server.use(restify.plugins.queryParser());
        server.use(restify.plugins.bodyParser());
        const cors = corsMiddleware({
            preflightMaxAge: 5, // Optional
            origins: ['*'],
            allowHeaders: ['API-Token'],
            exposeHeaders: ['API-Token-Expiry'],
        });

        server.pre(cors.preflight);
        server.use(cors.actual);

        server.listen(parseInt(config.node_rpc_port, 10), '0.0.0.0', () => {
            log.notify(`${server.name} exposed at ${server.url}`);
        });
        this.exposeAPIRoutes(server, emitter);
    }

    /**
     * API Routes
     */
    exposeAPIRoutes(server, emitter) {
        const authorize = (req, res) => {
            const request_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            const remote_access = config.remote_access_whitelist;

            if (remote_access.find(ip => Utilities.isIpEqual(ip, request_ip)) === undefined) {
                res.status(403);
                res.send({
                    message: 'Unauthorized request',
                    data: [],
                });
                return false;
            }
            return true;
        };


        /**
         * Data import route
         * @param importfile - file or text data
         * @param importtype - (GS1/WOT)
         */
        server.post('/api/import', (req, res) => {
            log.trace('POST Import request received.');

            if (!authorize(req, res)) {
                return;
            }

            if (req.body === undefined) {
                res.status(400);
                res.send({
                    message: 'Bad request',
                });
                return;
            }

            const supportedImportTypes = ['GS1', 'WOT'];

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
                const queryObject = {
                    filepath: inputFile,
                    contact: req.contact,
                    response: res,
                };

                emitter.emit(`${importtype}-import-request`, queryObject);
            } else if (req.body.importfile !== undefined) {
                // Check if import data is provided in request body
                const fileData = req.body.importfile;
                fs.writeFile('tmp/import.xml', fileData, (err) => {
                    if (err) {
                        return console.log(err);
                    }
                    console.log('The file was saved!');

                    const inputFile = '/tmp/import.tmp';
                    const queryObject = {
                        filepath: inputFile,
                        contact: req.contact,
                        response: res,
                    };

                    emitter.emit(`${importtype}-import-request`, queryObject);
                });
            } else {
                // No import data provided
                res.status(400);
                res.send({
                    message: 'No import data provided',
                });
            }
        });

        server.post('/api/replication', (req, res) => {
            log.trace('POST Replication request received.');

            if (!authorize(req, res)) {
                return;
            }


            if (req.body !== undefined && req.body.import_id !== undefined) {
                const queryObject = {
                    import_id: req.body.import_id,
                    contact: req.contact,
                    response: res,
                };
                emitter.emit('create-offer', queryObject);
            } else {
                log.error('Invalid request. You need to provide import ID');
                res.status(400);
                res.send({
                    message: 'Import ID not provided!',
                });
            }
        });

        server.get('/api/replication/:replication_id', (req, res) => {
            log.trace('GET Replication status request received');

            if (!authorize(req, res)) {
                return;
            }

            const externalId = req.params.replication_id;
            if (externalId == null) {
                log.error('Invalid request. You need to provide replication ID');
                res.status = 400;
                res.send({
                    message: 'Replication ID is not provided',
                });
            } else {
                const queryObject = {
                    external_id: externalId,
                    response: res,
                };
                emitter.emit('offer-status', queryObject);
            }
        });

        /**
         * Get trail from database
         * @param QueryObject - ex. {uid: abc:123}
         */
        server.get('/api/trail', (req, res) => {
            log.trace('GET Trail request received.');
            const queryObject = req.query;
            emitter.emit('trail', {
                query: queryObject,
                response: res,
            });
        });

        /** Get root hash for provided data query
         * @param Query params: dc_wallet, import_id
         */
        server.get('/api/fingerprint', (req, res) => {
            log.trace('GET Fingerprint request received.');
            const queryObject = req.query;
            emitter.emit('get_root_hash', {
                query: queryObject,
                response: res,
            });
        });

        server.get('/api/network/query_by_id', (req, res) => {
            log.trace('GET Query by ID received.');

            const queryObject = req.query;
            const query = [{
                path: 'identifiers.id',
                value: queryObject.id,
                opcode: 'EQ',
            }];
            emitter.emit('network-query', {
                query,
                response: res,
            });
        });

        server.get('/api/network/query/:query_param', (req, res) => {
            log.trace('GET Query for status request received.');
            if (!req.params.query_param) {
                res.send({
                    status: 'FAIL',
                    error: 'Param required.',
                });
                return;
            }
            emitter.emit('network-query-status', {
                id: req.params.query_param,
                response: res,
            });
        });

        server.post('/api/network/query', (req, res) => {
            log.trace('POST Query request received.');

            const { query } = req.body;
            emitter.emit('network-query', {
                query,
                response: res,
            });
        });

        /**
         * Get vertices by query
         * @param queryObject
         */
        server.get('/api/query', (req, res) => {
            log.trace('GET Query request received.');
            const queryObject = req.query;
            emitter.emit('query', {
                query: queryObject,
                response: res,
            });
        });
    }
}

console.log('===========================================');
console.log(`         OriginTrail Node v${pjson.version}`);
console.log('===========================================');

const otNode = new OTNode();
otNode.bootstrap().then(() => {
    log.info('OT Node started');
});

