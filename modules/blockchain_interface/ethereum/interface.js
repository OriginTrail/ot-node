var fs = require('fs');
var Web3 = require('web3');
var utilities = require('../../utilities')();
var signing =
    require('./signing')();

let contractInstance;
const log = utilities.getLogger();
const config = utilities.getConfig();


module.exports = () => {
    var web3 = new Web3(new Web3.providers.HttpProvider(`${config.blockchain.settings.ethereum.rpc_node}:${config.blockchain.settings.ethereum.node_port}`));
    var { contract_address, token_address } = config.blockchain.settings.ethereum;
    var escrow_address = config.blockchain.settings.ethereum.escrow_contract;

    var contract_abi_path = config.blockchain.settings.ethereum.contract_abi;
    var contract_abi_file = fs.readFileSync(contract_abi_path);
    var contract_abi = JSON.parse(contract_abi_file);

    var token_abi_path = config.blockchain.settings.ethereum.token_abi;
    var token_abi_file = fs.readFileSync(token_abi_path);
    var token_abi = JSON.parse(token_abi_file);

    var escrow_abi_path = config.blockchain.settings.ethereum.escrow_abi;
    var escrow_abi_file = fs.readFileSync(escrow_abi_path);
    var escrow_abi = JSON.parse(escrow_abi_file);

    var ot_contract = new web3.eth.Contract(contract_abi, contract_address);
    var token_contract = new web3.eth.Contract(token_abi, token_address);
    var escrow_contract = new web3.eth.Contract(escrow_abi, escrow_address);

    var theInterface = {

        giveAllowance(ammount, callback) {
            signing.signAndAllow(ammount, callback);
            return true;
        },

        createEscrow(
            DC_wallet, DH_wallet, data_id,
            token_amount, start_time, total_time, callback,
        ) {
            signing.createEscrow(
                DC_wallet, DH_wallet, data_id,
                token_amount, start_time, total_time, callback,
            );
            return true;
        },


        getFingerprintByBatchHash(address, dataIdHash) {
            return contractInstance.getFingerprintByBatchHash(address, dataIdHash, {
                from: web3.eth.accounts[0],
            });
        },

        addFingerprint(data_id, dataIdHash, import_hash) {
            signing.signAndSend(data_id, dataIdHash, import_hash);
            return true;
        },

        getFingerprint(data_holder_address, import_hash, callback) {
            var graph_hash = null;
            let dataIdHash;
            graph_hash = contractInstance.getFingerprintByBatchHash(

                data_holder_address, dataIdHash,
                {
                    from: web3.eth.accounts[0],
                },
            );

            utilities.executeCallback(callback, graph_hash);
            return graph_hash;
        },
    };

    return theInterface;
};
