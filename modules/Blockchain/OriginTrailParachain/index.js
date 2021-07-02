const path = require('path');

const Utilities = require('../../Utilities');
const Web3Implementation = require('../Web3Implementation');


const ProfileContractAbi = require('./build/contracts/Profile').abi;
const IdentityContractBytecode = require('./build/contracts/Identity').bytecode;

const Web3 = require('web3');

// todo retrieve web3 from config
const web3 = new Web3('http://139.59.150.89:9933');


class OriginTrailParachain extends Web3Implementation {
    /**
     * Initializing OriginTrail Parachain blockchain connector
     */
    constructor({ config, emitter, logger }, configuration) {
        super({
            config,
            emitter,
            logger,
            contractPath: path.join(__dirname, 'abi'),
        }, configuration);

        this.logger.info(`[${this.getBlockchainId()}] Selected blockchain: OriginTrail Parachain`);
    }

    async getRelativeTracPrice() {
        return '1';
    }

    async calculateGasPrice() {
        // TODO Add logic for pricing mechanism based on Parachain
        return this.config.gas_price;
    }

    async getGasPrice() {
        // TODO Add logic for pricing mechanism based on Parachain
        return this.config.gas_price;
    }

    /**
     * Creates node profile on the Profile contract
     * @param managementWallet - Management wallet
     * @param profileNodeId - Network node ID
     * @param {Object<BigNumber>} initialBalance - Initial profile balance
     * @param {Boolean} hasERC725 - Does sender already have an ERC 725 identity?
     * @param blockchainIdentity - ERC 725 identity (empty if there is none)
     * @return {Promise<any>}
     */
    async createProfile(
        managementWallet,
        profileNodeId,
        initialBalance,
        hasERC725,
        blockchainIdentity,
    ) {

        // todo remove console logs
        console.log(this.config.node_wallet);
        console.log(this.config.node_private_key);

        // todo remove balance check
        const balance = await web3.eth.getBalance(this.config.node_wallet);
        console.log(`Balance of ${this.config.node_wallet} is ${balance}`);

        const parameters = web3.eth.abi.encodeParameters(
            ['address'],
            [this.config.node_wallet],
        ).slice(2);

        // todo change hardcoded values
        let createTransaction = await web3.eth.accounts.signTransaction({
            from: this.config.node_wallet,
            data: `${IdentityContractBytecode}${parameters}`,
            value: '0x00',
            gas: 6000000,
            gasPrice: 100,
            chainId: 2160,
        }, this.config.node_private_key);

        // console.log(createTransaction);

        let createReceipt = await web3.eth.sendSignedTransaction(createTransaction.rawTransaction);
        console.log('Identity contract deployed at address', createReceipt.contractAddress);
        const profileAddress = createReceipt.contractAddress;

        // todo change hardcoded values
        const gasPrice = await this.getGasPrice();
        const options = {
            gasLimit: this.web3.utils.toHex(6000000),
            gasPrice: this.web3.utils.toHex(1000),
            value: web3.utils.toWei('5', 'ether'), //initialBalance.toString(16),
            to: this.profileContractAddress,
        };
        // profileNodeId = `000000000000000000000000${profileNodeId}`;
        profileNodeId = Utilities.normalizeHex(profileNodeId);


        // todo change this
        const ProfileContractAddress = '0x1d88E11AF868BB01CA9b29D7316AA7CDC7674689';

        let util = new web3.eth.Contract(ProfileContractAbi, ProfileContractAddress);
        const data = util.methods.createProfile(managementWallet, profileNodeId, profileAddress).encodeABI();
        createTransaction = await web3.eth.accounts.signTransaction({
            from: this.config.node_wallet,
            to: ProfileContractAddress,
            data,
            value: web3.utils.toWei('1', 'ether'),
            gas: 2000000,
            gasPrice: 100,
            chainId: 2160,
        }, this.config.node_private_key);

        console.log();
        console.log("Call Profile contract...");
        createReceipt = await web3.eth.sendSignedTransaction(createTransaction.rawTransaction);
        //
        //
        // this.logger.trace(`[${this.getBlockchainId()}] CreateProfile(${managementWallet}, ${profileNodeId}, ${profileAddress}), value ${initialBalance}`);
        // return this.transactions.queueTransaction(
        //     this.profileContractAbi, 'createProfile',
        //     [
        //         managementWallet, profileNodeId, profileAddress,
        //     ], options,
        // );
    }
}

module.exports = OriginTrailParachain;
