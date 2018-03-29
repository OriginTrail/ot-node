const Utilities = require('./modules/utilities');
const GraphStorage = require('./modules/Database/graphStorage');

Utilities.getConfig().then((response) => {
    //   console.log(response);
}).catch((err) => {
    console.log(err);
});

const graphDB = new GraphStorage();
graphDB.connect().then((response) => {
    //  console.log(response);
    graphDB.addDocument('ot_vertices', {_key:'123'}).then(() => {
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
