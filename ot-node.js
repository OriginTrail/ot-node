const Utilities = require('./modules/utilities');
const GraphStorage = require('./modules/Database/graphStorage');
const deasync = require('deasync-promise');
const MerkleTree = require('./modules/merkle');
const Challenge = require('./modules/challenge');
const SystemStorage = require('./modules/Database/systemStorage');

const log = Utilities.getLogger();

class OTNode {
    /**
     * OriginTrail node system bootstrap function
     */
    bootstrap() {
        const loadConfig = Utilities.loadConfig();
        const loadSelectedDatabase = Utilities.loadSelectedDatabaseInfo();
        var selectedDatabase;

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


console.log('Test...');

var startTime = new Date('May 1, 2018 03:24:00').getTime();
var endTime = new Date('January 1, 2019 00:24:00').getTime();
var vertexData = [
    { vertexKey: 'vertex0', data: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt' },
    { vertexKey: 'vertex1', data: ' ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation' },
    { vertexKey: 'vertex2', data: ' ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis' },
    { vertexKey: 'vertex3', data: ' aute irure dolor in reprehenderit in voluptate velit esse cillum' },
    { vertexKey: 'vertex4', data: ' dolore eu fugiat' },
    { vertexKey: 'vertex5', data: ' nulla pariatur. Excepteur sint occaecat cupidatat non proident' },
    { vertexKey: 'vertex6', data: ', sunt in culpa qui officia deserunt ' },
    { vertexKey: 'vertex7', data: 'mollit' },
    { vertexKey: 'vertex8', data: ' anim ' },
    { vertexKey: 'vertex9', data: ' id est laborum' },
];

var tests = Challenge.generateTests(
    'dataCreator1', 'import1',
    20, startTime, endTime, 32, vertexData,
);
for (let i = 0; i < tests.length; i += 1) {
    console.log(tests[i]);
}

deasync(Challenge.addTests(tests));
const testsFromDb = deasync(Challenge.getTests('dataCreator1'));
console.log('tests from db');
for (let i = 0; i < testsFromDb.length; i += 1) {
    console.log(testsFromDb[i]);
}

console.log('finito');
