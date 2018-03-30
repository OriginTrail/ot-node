const Utilities = require('./modules/utilities');
const GraphStorage = require('./modules/Database/graphStorage');
const deasync = require('deasync-promise');

const log = Utilities.getLogger();

class OTNode {
    bootstrap() {
        const loadConfig = Utilities.loadConfig();
        const loadSelectedDatabase = Utilities.loadSelectedDatabaseInfo();
        var selectedDatabase;

        // Loading config data and selected graph database data
        try {
            this.config = deasync(loadConfig);
            selectedDatabase = deasync(loadSelectedDatabase);
        } catch (err) {
            console.log(err);
        }

        this.graphDB = new GraphStorage(selectedDatabase);

        // Connecting to graph database
        try {
            deasync(this.graphDB.connect());
        } catch (err) {
            console.log(err);
        }
    }
}

const otNode = new OTNode();
otNode.bootstrap();

log.info(otNode.config);

otNode.graphDB.runQuery('FOR v IN ot_vertices RETURN v._key').then((result) => {
    console.log(result);
}).catch((err) => {
    console.log(err);
});


/*
const graphDB = new GraphStorage();
graphDB.connect().then((response) => {
    //  console.log(response);
    graphDB.addDocument('ot_vertices', { _key: '123' }).then(() => {
        graphDB.runQuery('FOR v IN ot_vertices RETURN v._key').then((result) => {
            console.log(result);
        }).catch((err) => {
            console.log(err);
        });
    }).catch((err) => {
        console.log(err);
    });
}).catch((err) => {
    console.log(err);
});
*/
