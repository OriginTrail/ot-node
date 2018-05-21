const Network = require('./modules/Network');
const Utilities = require('./modules/Utilities');
const GraphStorage = require('./modules/Database/GraphStorage');
const Graph = require('./modules/Graph');
const Product = require('./modules/Product');
const Blockchain = require('./modules/Blockchain');
const globalEvents = require('./modules/GlobalEvents');
const restify = require('restify');
const fs = require('fs');
const models = require('./models');
const Storage = require('./modules/Storage');
const config = require('./modules/Config');
const RemoteControl = require('./modules/RemoteControl');
const corsMiddleware = require('restify-cors-middleware');

const BCInstance = require('./modules/BlockChainInstance');
const GraphInstance = require('./modules/GraphInstance');
const GSInstance = require('./modules/GraphStorageInstance');
const ProductInstance = require('./modules/ProductInstance');
const DHService = require('./modules/DHService');
const BN = require('bn.js');
require('./modules/EventHandlers');

const pjson = require('./package.json');

const log = Utilities.getLogger();
const { globalEmitter } = globalEvents;

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
                log.error('Please make sure Arango server is runing before starting ot-node');
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

        // wire instances
        GSInstance.db = new GraphStorage(selectedDatabase);
        BCInstance.bc = new Blockchain(selectedBlockchain);
        ProductInstance.p = new Product();
        GraphInstance.g = new Graph();

        // Connecting to graph database
        try {
            await GSInstance.db.connect();
            log.info(`Connected to graph database: ${GSInstance.db.identify()}`);
        } catch (err) {
            log.error(`Failed to connect to the graph database: ${GSInstance.db.identify()}`);
            console.log(err);
            process.exit(1);
        }

        // Initialise API
        this.startRPC();

        // Starting the kademlia
        const network = new Network();
        network.start().then(async (res) => {
            await this.createProfile();
        }).catch((e) => {
            console.log(e);
        });

        if (parseInt(config.remote_control_enabled, 10)) {
            log.info(`Remote control enabled and listening on port ${config.remote_control_port}`);
            await RemoteControl.connect();
        }

        // Starting event listener on Blockchain
        log.info('Starting blockchain event listener');
        setInterval(() => {
            BCInstance.bc.getAllPastEvents('BIDDING_CONTRACT');
        }, 3000);

        DHService.listenToOffers();
    }

    /**
     * Creates profile on the contract
     */
    async createProfile() {
        const profileInfo = await BCInstance.bc.getProfile(config.node_wallet);
        if (profileInfo.active) {
            log.trace(`Profile has already been created for ${config.identity}`);
            return;
        }

        await BCInstance.bc.createProfile(
            config.identity,
            config.dh_price,
            config.dh_stake_factor,
            config.dh_max_time_mins,
            config.dh_max_data_size_bytes,
        );
        const event = await BCInstance.bc.subscribeToEvent('ProfileCreated', null);
        if (event.node_id.includes(config.identity)) {
            log.info(`Profile created for node: ${config.identity}`);
        }
    }

    /**
     * Start RPC server
     */
    startRPC() {
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

        server.listen(parseInt(config.node_rpc_port, 10), config.node_rpc_ip, () => {
            log.notify('%s exposed at %s', server.name, server.url);
        });

        this.exposeAPIRoutes(server);
    }

    /**
     * API Routes
     */
    exposeAPIRoutes(server) {
        server.post('/import', (req, res) => {
            log.important('Import request received!');

            const request_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            const remote_access = config.remote_access_whitelist;

            if (remote_access.find(ip => Utilities.isIpEqual(ip, request_ip)) === undefined) {
                res.send({
                    message: 'Unauthorized request',
                    data: [],
                });
                return;
            }

            if (req.files === undefined || req.files.importfile === undefined) {
                if (req.body.importfile !== undefined) {
                    const fileData = req.body.importfile;

                    fs.writeFile('tmp/import.xml', fileData, (err) => {
                        if (err) {
                            return console.log(err);
                        }
                        console.log('The file was saved!');

                        const input_file = '/tmp/import.xml';
                        const queryObject = {
                            filepath: input_file,
                            contact: req.contact,
                            response: res,
                        };

                        globalEmitter.emit('gs1-import-request', queryObject);
                    });
                } else {
                    res.send({
                        status: 400,
                        message: 'Input file not provided!',
                    });
                }
            } else {
                const input_file = req.files.importfile.path;
                const queryObject = {
                    filepath: input_file,
                };

                globalEmitter.emit('import-request', queryObject);
            }
        });

        server.post('/import_gs1', (req, res) => {
            log.important('Import request received!');

            const request_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            const remote_access = config.remote_access_whitelist;

            if (remote_access.find(ip => Utilities.isIpEqual(ip, request_ip)) === undefined) {
                res.send({
                    message: 'Unauthorized request',
                    data: [],
                });
                return;
            }

            if (req.files === undefined || req.files.importfile === undefined) {
                if (req.body.importfile !== undefined) {
                    const fileData = req.body.importfile;

                    fs.writeFile('tmp/import.xml', fileData, (err) => {
                        if (err) {
                            return console.log(err);
                        }
                        console.log('The file was saved!');

                        const input_file = '/tmp/import.xml';
                        const queryObject = {
                            filepath: input_file,
                            contact: req.contact,
                            response: res,
                        };

                        globalEmitter.emit('gs1-import-request', queryObject);
                    });
                } else {
                    res.send({
                        status: 400,
                        message: 'Input file not provided!',
                    });
                }
            } else {
                const input_file = req.files.importfile.path;
                const queryObject = {
                    filepath: input_file,
                    contact: req.contact,
                    response: res,
                };

                globalEmitter.emit('gs1-import-request', queryObject);
            }
        });

        server.get('/api/trail', (req, res) => {
            const queryObject = req.query;
            globalEmitter.emit('trail', {
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

