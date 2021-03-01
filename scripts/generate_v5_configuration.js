const fs = require('fs');
require('dotenv').config();
const defaultConfigJson = require('../config/config.json');

const nodercConfigPath = '/ot-node/.origintrail_noderc';
const v5ConfigPath = '/ot-node/data/.v5_configuration';

try {
    console.log('Starting configuration update');
    const defaultConfig = defaultConfigJson[process.env.NODE_ENV];
    const configFile = fs.readFileSync(nodercConfigPath);
    const config = JSON.parse(configFile);
    const { blockchain } = config;
    blockchain.blockchain_title = defaultConfig.blockchain.blockchain_title;
    blockchain.network_id = defaultConfig.blockchain.network_id;
    blockchain.node_wallet = config.node_wallet;
    delete config.node_wallet;
    blockchain.node_private_key = config.node_private_key;
    delete config.node_private_key;
    blockchain.management_wallet = config.management_wallet;
    delete config.management_wallet;
    if (config.erc725_identity_filepath) {
        blockchain.identity_filepath = config.erc725_identity_filepath;
        delete config.erc725_identity_filepath;
    } else {
        blockchain.identity_filepath = defaultConfig.erc725_identity_filepath;
    }
    delete config.blockchain;

    config.blockchain = {
        implementations: [blockchain],
    };
    fs.writeFileSync(v5ConfigPath, JSON.stringify(config, null, 4));
    console.log('Configuration version 5 generated in data/.v5_configuration');
} catch (error) {
    console.log('Failed to generate configuration version 5', error.message);
    process.exit(1);
}
