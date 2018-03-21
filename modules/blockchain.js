// External modules
const utilities = require('./utilities');

const log = utilities.getLogger();
const config = utilities.getConfig();
const chain = config.blockchain.preferred_chain;
let chainInterface = null;
// log.info(chain);

switch (chain) {
case 'ethereum':
case 'iota':
case 'neo':
    // eslint-disable-next-line global-require,import/no-dynamic-require
    chainInterface = require(`./blockchain_interface/${chain}/interface.js`)(config);
    break;
default:
    chainInterface = null;
    log.info('ERROR: Couldn\'t load blockchain interaface, please check your config file.');
}

module.exports = () => {
    const blockchain = {
        addFingerprint(batch_uid, batch_uid_hash, trail_hash) {
            log.info('Writing on blockchain...');
            log.info(batch_uid);
            log.info(batch_uid_hash);
            log.info(trail_hash);

            log.info();

            chainInterface.addFingerprint(batch_uid, batch_uid_hash, trail_hash);
        },

        getFingerprint(wid, bid, callback) {
            return chainInterface.getFingerprint(wid, bid, callback);
        },
    };

    return blockchain;
};
