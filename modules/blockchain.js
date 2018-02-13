// External modules
var utilities = require('./utilities')();
var product = require('./product')();
var config = utilities.getConfig();
var chain = config.blockchain.preferred_chain;
var chainInterface = null;
//console.log(chain);

switch (chain) {
  case "ethereum":
  case "iota":
  case "neo":
    chainInterface = require("./blockchain_interface/" + chain + "/interface.js")(config);
    break;
  default:
    chainInterface = null;
    console.log("ERROR: Couldn't load blockchain interaface, please check your config file.");
}

module.exports = function () {

  var blockchain = {
    addFingerprint: function (batch_uid, batch_uid_hash, trail_hash) {

      console.log(batch_uid);
      console.log(batch_uid_hash)
      console.log(trail_hash);
      console.log('ovde');

      // chainInterface.addFingerprint(batch_uid, batch_uid_hash, trail_hash);
    },

    getFingerprint: function (wid, bid, callback) {

      var fingerprint = chainInterface.getFingerprint(wid, bid, callback);
      return true;
    },
  }

  return blockchain;
}