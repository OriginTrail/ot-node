require('dotenv').config({ path: '../.env' });

const ip = require('ip');
const fs = require('fs');
const rc = require('rc');
const path = require('path');
const homedir = require('os').homedir();
const Web3 = require('web3');
const deepExtend = require('deep-extend');
const pjson = require('../package.json');
const configjson = require('../config/config.json');
const argv = require('minimist')(process.argv.slice(2));

const defaultConfig = configjson[process.env.NODE_ENV];
const localConfiguration = rc(pjson.name, defaultConfig);
const web3 = new Web3(new Web3.providers.HttpProvider(`${localConfiguration.blockchain.rpc_node_host}`));

if (argv.configDir) {
    localConfiguration.appDataPath = argv.configDir;
    console.log(`congigDir given as param '${argv.configDir}'.`);
} else {
    localConfiguration.appDataPath = path.join(
        homedir,
        `.${pjson.name}rc`,
        process.env.NODE_ENV,
    );
}

function main() {
    const localConfigPath = path.join('/ot-node/', `.${pjson.name}rc`);
    let externalConfig = {};

    // Use any previous saved configuration
    if (fs.existsSync(localConfigPath)) {
        externalConfig = JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
    }

    if (!process.env.NODE_WALLET || !process.env.NODE_PRIVATE_KEY ||
        !web3.utils.isAddress(process.env.NODE_WALLET)) {
        console.error('Wallet not provided! Please provide valid wallet.');
    } else {
        externalConfig.node_wallet = process.env.NODE_WALLET;
        externalConfig.node_private_key = process.env.NODE_PRIVATE_KEY;
    }

    if (process.env.ERC_725_IDENTITY) {
        const erc725IdentityFilePath =
            path.join(localConfiguration.appDataPath, localConfiguration.erc725_identity_filepath);
        const content = { identity: process.env.ERC_725_IDENTITY };
        fs.writeFileSync(erc725IdentityFilePath, JSON.stringify(content, null, 4));
        console.log('Identity given: ', process.env.ERC_725_IDENTITY);
    }

    if (process.env.KAD_IDENTITY && process.env.KAD_IDENTITY_CHILD_INDEX) {
        const identityFilePath =
            path.join(localConfiguration.appDataPath, localConfiguration.identity_filepath);
        const content = {
            xprivkey: process.env.KAD_IDENTITY,
            index: parseInt(process.env.KAD_IDENTITY_CHILD_INDEX, 10),
        };
        fs.writeFileSync(identityFilePath, JSON.stringify(content, null, 4));
        console.log('Kademlia identity given: ', process.env.KAD_IDENTITY);
    }

    if (process.env.IMPORT_WHITELIST) {
        if (!externalConfig.network) {
            externalConfig.network = {};
        }
        externalConfig.network.remoteWhitelist = process.env.IMPORT_WHITELIST.split(',');
    }

    deepExtend(localConfiguration, externalConfig);
    console.log('Configuration:');
    // Mask private key before printing it.
    const externalConfigClean = Object.assign({}, externalConfig);
    externalConfigClean.node_private_key = '*** MASKED ***';
    console.log(JSON.stringify(externalConfigClean, null, 4));

    fs.writeFileSync(`.${pjson.name}rc`, JSON.stringify(externalConfig, null, 4));

    // eslint-disable-next-line
    require('../ot-node');
}

main();
