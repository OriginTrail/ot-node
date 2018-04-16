// TODO rewrite this test for mocha

const SystemStorage = require('../../modules/Database/SystemStorage');

var sysdb = new SystemStorage();

sysdb.connect().then(() => {
    sysdb.runSystemQuery('SELECT Date(?) as Date', ['now']).then((rows) => {
        console.log(rows);
    }).catch((err) => {
        console.log(err);
    });
}).catch((err) => {
    console.log(err);
});
