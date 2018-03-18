const utilities = require('./utilities')();

const log = utilities.getLogger();

const db = require('mongodb').MongoClient;

const url = 'mongodb://localhost:27017';

let dbo;


module.exports = function () {
    const storage = {
        storeObject(key, obj, callback) {
            // eslint-disable-next-line no-shadow
            db.connect(url, (err, db) => {
                dbo = db.db('origintrail');
                // eslint-disable-next-line no-shadow
                dbo.createCollection('ot_system', (err, res) => {
                    // eslint-disable-next-line no-shadow
                    dbo.collection('ot_system').findOne({ key }, (err, result) => {
                        if (result == null) {
                            // eslint-disable-next-line no-shadow
                            dbo.collection('ot_system').insertOne({ key, data: obj }, (err, res) => {
                                if (err) throw err;
                                utilities.executeCallback(callback, true);
                            });
                            db.close();
                        } else {
                            const query = { key };
                            const newvalues = { $set: { key, data: obj } };
                            // eslint-disable-next-line no-shadow
                            dbo.collection('ot_system').updateOne(query, newvalues, (err, res) => {
                                if (result == null) {
                                    utilities.executeCallback(callback, false);
                                    db.close();
                                } else {
                                    utilities.executeCallback(callback, true);
                                    db.close();
                                }
                            });
                        }
                    });
                });
            });
        },

        getObject(keyToFind, callback) {
            // eslint-disable-next-line no-shadow
            db.connect(url, (err, db) => {
                dbo = db.db('origintrail');
                // eslint-disable-next-line no-shadow
                dbo.collection('ot_system').findOne({ key: keyToFind }, (err, result) => {
                    if (err || result == null) {
                        // log.info('Storage: ' + err);
                        utilities.executeCallback(callback, []);
                    } else {
                        utilities.executeCallback(callback, result.data);
                    }
                    db.close();
                });
            });
        },
    };

    return storage;
};
