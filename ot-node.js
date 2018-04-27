const Network = require('./modules/Network');
const Utilities = require('./modules/Utilities');
const GraphStorage = require('./modules/Database/GraphStorage');
const Graph = require('./modules/Graph');
const Product = require('./modules/Product');
const SystemStorage = require('./modules/Database/SystemStorage');
const Blockchain = require('./modules/Blockchain');
const deasync = require('deasync-promise');
const globalEvents = require('./modules/GlobalEvents');
const MerkleTree = require('./modules/Merkle');
const restify = require('restify');
var models = require('./models');
const Storage = require('./modules/Storage');
const config = require('./modules/Config');

const BCInstance = require('./modules/BlockChainInstance');
const GraphInstance = require('./modules/GraphInstance');
const GSInstance = require('./modules/GraphStorageInstance');
const ProductInstance = require('./modules/ProductInstance');
const MockSmartContract = require('./modules/temp/MockSmartContract');
const MockSmartContractInstance = require('./modules/temp/MockSmartContractInstance');
require('./modules/EventHandlers');

var pjson = require('./package.json');

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
    bootstrap() {

        
        try {
            // make sure arango database exists
            deasync(Utilities.checkDoesStorageDbExists());
            log.info('Storage database check done');
            // Checking root folder stucture
            Utilities.checkOtNodeDirStructure();
            log.info('ot-node folder structure checked');
        } catch (err) {
            console.log(err);
        }

        // sync models
        Storage.models = deasync(models.sequelize.sync()).models;

        // Loading config data
        try {
            deasync(Utilities.loadConfig());
            log.info('Loaded system config');
        } catch (err) {
            console.log(err);
        }

        let selectedDatabase;
        // Loading selected graph database data
        try {
            selectedDatabase = deasync(Utilities.loadSelectedDatabaseInfo());
            log.info('Loaded selected database data');
            config.database = selectedDatabase;
        } catch (err) {
            console.log(err);
        }

        let selectedBlockchain;
        // Loading selected graph database data
        try {
            selectedBlockchain = deasync(Utilities.loadSelectedBlockchainInfo());
            log.info(`Loaded selected blockchain network ${selectedBlockchain.blockchain_title}`);
            config.blockchain = selectedBlockchain;
        } catch (err) {
            console.log(err);
        }

        // wire instances
        GSInstance.db = new GraphStorage(selectedDatabase);
        BCInstance.bc = new Blockchain(selectedBlockchain);
        ProductInstance.p = new Product();
        GraphInstance.g = new Graph();
        MockSmartContractInstance.sc = new MockSmartContract();

        // Connecting to graph database
        try {
            deasync(GSInstance.db.connect());
            log.info(`Connected to graph database: ${GSInstance.db.identify()}`);
        } catch (err) {
            console.log(err);
        }

        // Initialise API
        this.startRPC();

        // Starting the kademlia
        const network = new Network();
        network.start().then((res) => {
            // console.log(res);
        }).catch((e) => {
            console.log(e);
        });
    }

    /**
     * Start RPC server
     */
    startRPC() {
        const server = restify.createServer({
            name: 'RPC server',
            version: pjson.version,
        });

        server.use(restify.plugins.acceptParser(server.acceptable));
        server.use(restify.plugins.queryParser());
        server.use(restify.plugins.bodyParser());

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
                res.send({
                    status: 400,
                    message: 'Input file not provided!',
                });
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
                res.send({
                    status: 400,
                    message: 'Input file not provided!',
                });
            } else {
                const input_file = req.files.importfile.path;
                const queryObject = {
                    filepath: input_file,
                    contact: req.contact,
                };

                globalEmitter.emit('gs1-import-request', queryObject);
            }
        });

        server.get('/api/trail/batches', (req, res) => {
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
otNode.bootstrap();

// otNode.blockchain.increaseApproval(5).then((response) => {
//     log.info(response);
// }).catch((err) => {
//     console.log(err);
// });
//
//


/*
const leaves = ['A', 'B', 'C', 'D', 'E'];

const tree = new MerkleTree(leaves);

console.log(tree.levels);
// console.log(tree.levels);
// console.log();
const h1 = Utilities.sha3(1);
const h2 = Utilities.sha3(2);
const h3 = Utilities.sha3(3); // !!!
const h4 = Utilities.sha3(4);
const h5 = Utilities.sha3(5);

const h12 = Utilities.sha3(h1,h2);
const h34 = Utilities.sha3(h3,h4);
const h55 = Utilities.sha3(h5,h5);

const h1234 = Utilities.sha3(h12, h34);
const h5555 = Utilities.sha3(h55, h55);

console.log(tree.verifyProof(proof, 2, 1));

const proof = tree.createProof(1);
console.log(proof);
console.log(tree.verifyProof(proof, 'B', 1));
console.log(tree.getRoot().toString('hex'));
*/
