const Utilities = require('./modules/utilities');
const GraphStorage = require('./modules/Database/graphStorage');

const log = Utilities.getLogger();

var config;
var graphDB;


class OTNode {

    bootstrap() {
        return new Promise((resolve, reject) => {
            Utilities.loadConfig().then((response) => {
                config = Utilities.getConfig();
                graphDB = new GraphStorage();

                graphDB.connect().then((response) => {
                    resolve('OK');

                }).catch((err) => {
                    console.log(err);
                    reject(err);
                });
            }).catch((err) => {
                console.log(err);
                reject(err);
            });
        });
    }
}

const otNode = new OTNode();
otNode.bootstrap().then((response) => {
    console.log(response);
    console.log(config);
    console.log(graphDB);
}).catch((err) => {
    console.log(err);
})

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
