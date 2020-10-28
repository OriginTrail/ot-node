const BN = require('bn.js');
const ethAbi = require('ethereumjs-abi');

const Utilities = require('./Utilities');
const Models = require('../models');
const ImportUtilities = require('./ImportUtilities');
const Encryption = require('./RSAEncryption');
const bytes = require('utf8-length');

/**
 * DV operations (querying network, etc.)
 */
class DVService {
    /**
     * Default constructor
     * @param ctx IoC context
     */
    constructor({
        blockchain, web3, config, graphStorage, logger, remoteControl,
    }) {
        this.blockchain = blockchain;
        this.web3 = web3;
        this.config = config;
        this.graphStorage = graphStorage;
        this.log = logger;
        this.remoteControl = remoteControl;
    }
}

module.exports = DVService;
