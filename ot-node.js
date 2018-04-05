const Utilities = require('./modules/utilities');
const GraphStorage = require('./modules/Database/graphStorage');
const deasync = require('deasync-promise');
const MerkleTree = require('./modules/merkle');
const Graph = require('./modules/graph');
const SystemStorage = require('./modules/Database/systemStorage');

const log = Utilities.getLogger();

class OTNode {
    /**
     * OriginTrail node system bootstrap function
     */
    bootstrap() {
        const loadConfig = Utilities.loadConfig();
        const loadSelectedDatabase = Utilities.loadSelectedDatabaseInfo();
        let selectedDatabase;

        // Loading config data and selected graph database data
        try {
            this.config = deasync(loadConfig);
            log.info('Loaded system config');
            selectedDatabase = deasync(loadSelectedDatabase);
            log.info('Loaded selected database data');
        } catch (err) {
            console.log(err);
        }

        this.graphDB = new GraphStorage(selectedDatabase);

        // Connecting to graph database
        try {
            deasync(this.graphDB.connect());
            log.info(`Connected to graph database: ${this.graphDB.identify()}`);
            this.graph = new Graph(this.graphDB, new SystemStorage());
        } catch (err) {
            console.log(err);
        }
    }
}

const otNode = new OTNode();
otNode.bootstrap();

const leaves = ['A', 'B', 'C', 'D', 'E'];

const tree = new MerkleTree(leaves);

console.log(tree.levels);
/*
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
*/

const proof = tree.createProof(1);
console.log(proof);
console.log(tree.verifyProof(proof, 'B', 1));
console.log(tree.getRoot().toString('hex'));
