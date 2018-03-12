// External modules
var utilities = require('./utilities')();
const log = utilities.getLogger();
var config = utilities.getConfig();
var chain = config.blockchain.preferred_chain;
var chainInterface = null;
//log.info(chain);

switch (chain) {
case 'ethereum':
case 'iota':
case 'neo':
	chainInterface = require('./blockchain_interface/' + chain + '/interface.js')(config);
	break;
default:
	chainInterface = null;
	log.info('ERROR: Couldn\'t load blockchain interaface, please check your config file.');
}

module.exports = function () {

	var blockchain = {
		addFingerprint: function (batch_uid, batch_uid_hash, trail_hash) {

			log.info('Writing on blockchain...');
			log.info(batch_uid);
			log.info(batch_uid_hash);
			log.info(trail_hash);

			log.info();

			chainInterface.addFingerprint(batch_uid, batch_uid_hash, trail_hash);
		},

		getFingerprint: function (wid, bid, callback) {
			return chainInterface.getFingerprint(wid, bid, callback);
		},
	};

	return blockchain;
};
