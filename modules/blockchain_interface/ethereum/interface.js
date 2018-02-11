var fs = require('fs');
var Web3 = require('web3');
var utilities = require('../../utilities')();

config = utilities.getConfig();


module.exports = function() {
  web3 = new Web3(new Web3.providers.HttpProvider(config.blockchain.settings.ethereum.rpc_node + ":" + config.blockchain.settings.ethereum.node_port));
  var contract_abi_path = config.blockchain.settings.ethereum.contract_abi;
  var contract_abi_file = fs.readFileSync(contract_abi_path);
  var contract_abi = JSON.parse(contract_abi_file);

  var ot_contract = web3.eth.contract(contract_abi);

  console.log(web3.eth.accounts[0]);

  var contract_instance = ot_contract.at(config.blockchain.settings.ethereum.contract_address);

  var interface = {
    getFingerprintByBatchHash: function(address, batch_id_hash) {
        web3.personal.unlockAccount(web3.eth.accounts[0], config.blockchain.settings.ethereum.password, 10);
        return contract_instance.getFingerprintByBatchHash(address, batch_id_hash, {
          from: web3.eth.accounts[0]
        });
      },
      addFingerprint: function(batch_id, batch_id_hash, graph_hash) {

        web3.personal.unlockAccount(web3.eth.accounts[0], config.blockchain.settings.ethereum.password, 10);
        contract_instance.addFingerPrint(batch_id, batch_id_hash, graph_hash, {
          from: web3.eth.accounts[0]
        });
        return true;
      },

      getFingerprint: function(data_holder_address, batch_id_hash, callback) {
        var graph_hash = null;
        web3.personal.unlockAccount(web3.eth.accounts[0], config.blockchain.settings.ethereum.password, 10);
        graph_hash = contract_instance.getFingerprintByBatchHash(data_holder_address, batch_id_hash, {
          from: web3.eth.accounts[0]
        });

        utilities.executeCallback(callback, graph_hash);
        return graph_hash;
      }
  };

  return interface;
}