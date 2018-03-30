const Network = require('./modules/Network');
const Utilities = require('./modules/utilities');
const GraphStorage = require('./modules/Database/graphStorage');
const deasync = require('deasync-promise');

const log = Utilities.getLogger();

/**
 * Main node object
 */

class OTNode {
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

        // Starting the kademlia
        const network = new Network(this.config);
        network.start();
    }
}

const otNode = new OTNode();
otNode.bootstrap();

