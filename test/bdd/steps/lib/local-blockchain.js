/* eslint-disable max-len */
const Ganache = require('ganache-core');
const Web3 = require('web3');
const solc = require('solc');
const fs = require('fs');
const path = require('path');
const EthWallet = require('ethereumjs-wallet');
const assert = require('assert');

const accountPrivateKeys = [
    '3cf97be6177acdd12796b387f58f84f177d0fe20d8558004e8db9a41cf90392a',
    '1e60c8e9aa35064cd2eaa4c005bda2b76ef1a858feebb6c8e131c472d16f9740',
    '2c26a937a1b8b20762e2e578899b98fd48b6ab2f8798cd03ccef2bee865c2c54',
    'a76e13d35326f5e06d20655d0edb2f60b8863280fabf8e3f0b1210cf0bb72eec',
    'd96876d0711ed11781efe0c04c95716c2e0acabc4eba418516d76be808a2fc54',
    '6be9ea24e3c2adf0ac4c6705b445827a57c80e6fefa10df3f480da8aa2c523a4',
    '6627e24e68bca3b29c548789aead92b48c0f4ce669842ff7e18ca356429b804c',
    '1e3bae753e15ee5e6e2548105b53736a3db7304ac7681d00c77caca0b848b0ba',
    '4bc5744a30e928d162ca580f9a034dfac7edc0415e0b9ddc2d221a155f6ec4ff',
    '03c5646544ea8e47174ac98e3b97338c486860897e31333318ee62d19e5ea118',
];

const wallets = accountPrivateKeys.map(privateKey => ({
    address: `0x${EthWallet.fromPrivateKey(Buffer.from(privateKey, 'hex')).getAddress().toString('hex')}`,
    privateKey,
}));

/**
 * LocalBlockchain represent small wrapper around the Ganache.
 *
 * LocalBlockchain uses the Ganache-core to run in-memory blockchain simulator. It uses
 * predefined accounts that can be fetch by calling LocalBlockchain.wallets(). Account with
 * index 7 is used for deploying contracts.
 *
 * Basic usage:
 * LocalBlockchain.wallets()[9].address
 * LocalBlockchain.wallets()[9].privateKey,
 *
 * const localBlockchain = new LocalBlockchain({ logger: this.logger });
 * await localBlockchain.initialize(); // Init the server.
 * // That will compile and deploy contracts. Later can be called
 * // deployContracts() to re-deploy fresh contracts.
 *
 * // After usage:
 *     if (localBlockchain.server) {
 *         this.state.localBlockchain.server.close();
 *     }
 *
 * @param {String} [options.logger] - Logger instance with debug, trace, info and error methods.
 */
class LocalBlockchain {
    constructor(options = {}) {
        this.logger = options.logger || console;
        this.server = Ganache.server({
            accounts: [
                { secretKey: `0x${accountPrivateKeys[0]}`, balance: Web3.utils.toWei('100', 'ether') },
                { secretKey: `0x${accountPrivateKeys[1]}`, balance: Web3.utils.toWei('100', 'ether') },
                { secretKey: `0x${accountPrivateKeys[2]}`, balance: Web3.utils.toWei('100', 'ether') },
                { secretKey: `0x${accountPrivateKeys[3]}`, balance: Web3.utils.toWei('100', 'ether') },
                { secretKey: `0x${accountPrivateKeys[4]}`, balance: Web3.utils.toWei('100', 'ether') },
                { secretKey: `0x${accountPrivateKeys[5]}`, balance: Web3.utils.toWei('100', 'ether') },
                { secretKey: `0x${accountPrivateKeys[6]}`, balance: Web3.utils.toWei('100', 'ether') },
                { secretKey: `0x${accountPrivateKeys[7]}`, balance: Web3.utils.toWei('100', 'ether') },
                { secretKey: `0x${accountPrivateKeys[8]}`, balance: Web3.utils.toWei('100', 'ether') },
                { secretKey: `0x${accountPrivateKeys[9]}`, balance: Web3.utils.toWei('100', 'ether') },
            ],
        });
        this.initialized = false;
    }

    async initialize() {
        return new Promise((accept, reject) => {
            this.server.listen(7545, async (err, blockchain) => {
                if (err) {
                    reject(err);
                    return;
                }
                this.logger.info('Blockchain is up at http://localhost:7545/');
                // TODO: Use url from server.
                this.web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:7545'));
                this.compileContracts();
                await this.deployContracts();
                assert(this.hubContractAddress !== '0x0000000000000000000000000000000000000000');
                assert(this.profileStorageContractAddress !== '0x0000000000000000000000000000000000000000');
                assert(this.holdingStorageContractAddress !== '0x0000000000000000000000000000000000000000');
                assert(this.tokenContractAddress !== '0x0000000000000000000000000000000000000000');
                assert(this.profileContractAddress !== '0x0000000000000000000000000000000000000000');
                assert(this.holdingContractAddress !== '0x0000000000000000000000000000000000000000');
                assert(this.readingContractAddress !== '0x0000000000000000000000000000000000000000');
                accept();
            });
        });
    }

    compileContracts() {
        const hubSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/Hub.sol'), 'utf8');
        const profileStorageSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/ProfileStorage.sol'), 'utf8');
        const holdingStorageSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/HoldingStorage.sol'), 'utf8');
        const tokenSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/TracToken.sol'), 'utf8');
        const profileSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/Profile.sol'), 'utf8');
        const holdingSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/Holding.sol'), 'utf8');
        const readingSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/Reading.sol'), 'utf8');
        const eRC725Source = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/ERC725.sol'), 'utf8');
        const safeMathSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/SafeMath.sol'), 'utf8');
        const identitySource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/Identity.sol'), 'utf8');
        const byteArrSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/ByteArr.sol'), 'utf8');


        let compileResult = solc.compile({ sources: { 'Hub.sol': hubSource } }, 1);
        this.hubContractData = `0x${compileResult.contracts['Hub.sol:Hub'].bytecode}`;
        this.hubContractAbi = JSON.parse(compileResult.contracts['Hub.sol:Hub'].interface);
        this.hubContract = new this.web3.eth.Contract(this.hubContractAbi);

        compileResult = solc.compile({
            sources: {
                'ProfileStorage.sol': profileStorageSource, 'TracToken.sol': tokenSource, 'Hub.sol': hubSource, 'HoldingStorage.sol': holdingStorageSource, 'Reading.sol': readingSource, 'Profile.sol': profileSource, 'Holding.sol': holdingSource, 'ERC725.sol': eRC725Source, 'SafeMath.sol': safeMathSource, 'Identity.sol': identitySource, 'ByteArr.sol': byteArrSource,
            },
        }, 1);

        this.profileStorageContractData = `0x${compileResult.contracts['ProfileStorage.sol:ProfileStorage'].bytecode}`;
        this.profileStorageContractAbi = JSON.parse(compileResult.contracts['ProfileStorage.sol:ProfileStorage'].interface);
        this.profileStorageContract = new this.web3.eth.Contract(this.profileStorageContractAbi);

        this.holdingStorageContractData = `0x${compileResult.contracts['HoldingStorage.sol:HoldingStorage'].bytecode}`;
        this.holdingStorageContractAbi = JSON.parse(compileResult.contracts['HoldingStorage.sol:HoldingStorage'].interface);
        this.holdingStorageContract = new this.web3.eth.Contract(this.holdingStorageContractAbi);

        this.tokenContractData = `0x${compileResult.contracts['TracToken.sol:TracToken'].bytecode}`;
        this.tokenContractAbi = JSON.parse(compileResult.contracts['TracToken.sol:TracToken'].interface);
        this.tokenContract = new this.web3.eth.Contract(this.tokenContractAbi);

        this.readingContractData = `0x${compileResult.contracts['Reading.sol:Reading'].bytecode}`;
        this.readingContractAbi = JSON.parse(compileResult.contracts['Reading.sol:Reading'].interface);
        this.readingContract = new this.web3.eth.Contract(this.readingContractAbi);

        this.profileContractData = `0x${compileResult.contracts['Profile.sol:Profile'].bytecode}`;
        this.profileContractAbi = JSON.parse(compileResult.contracts['Profile.sol:Profile'].interface);
        this.profileContract = new this.web3.eth.Contract(this.profileContractAbi);

        this.holdingContractData = `0x${compileResult.contracts['Holding.sol:Holding'].bytecode}`;
        this.holdingContractAbi = JSON.parse(compileResult.contracts['Holding.sol:Holding'].interface);
        this.holdingContract = new this.web3.eth.Contract(this.holdingContractAbi);
    }

    async deployContracts() {
        const accounts = await this.web3.eth.getAccounts();
        this.logger.log('Deploying hubContract');
        [this.hubDeploymentReceipt, this.hubInstance] = await this.deployContract(
            this.web3, this.hubContract, this.hubContractData,
            [], accounts[7],
        );
        this.logger.log('Deploying profileStorageContract');
        [this.profileStorageDeploymentReceipt, this.profileStorageInstance] = await this.deployContract(
            this.web3, this.profileStorageContract, this.profileStorageContractData,
            [this.hubInstance._address], accounts[7],
        );

        await this.hubInstance.methods.setProfileStorageAddress(this.profileStorageInstance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        this.logger.log('Deploying holdingStorageContract');
        [this.holdingStorageDeploymentReceipt, this.holdingStorageInstance] = await this.deployContract(
            this.web3, this.holdingStorageContract, this.holdingStorageContractData,
            [this.hubInstance._address], accounts[7],
        );

        await this.hubInstance.methods.setHoldingStorageAddress(this.holdingStorageInstance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        this.logger.log('Deploying tokenContract');
        [this.tokenDeploymentReceipt, this.tokenInstance] = await this.deployContract(
            this.web3, this.tokenContract, this.tokenContractData,
            [accounts[7], accounts[8], accounts[9]], accounts[7],
        );

        await this.hubInstance.methods.setTokenAddress(this.tokenInstance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        this.logger.log('Deploying profileContract');
        [this.profileDeploymentReceipt, this.profileInstance] = await this.deployContract(
            this.web3, this.profileContract, this.profileContractData,
            [this.hubInstance._address], accounts[7],
        );

        await this.hubInstance.methods.setProfileAddress(this.profileInstance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        this.logger.log('Deploying holdingContract');
        [this.holdingDeploymentReceipt, this.holdingInstance] = await this.deployContract(
            this.web3, this.holdingContract, this.holdingContractData,
            [this.hubInstance._address], accounts[7],
        );

        await this.hubInstance.methods.setHoldingAddress(this.holdingInstance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        this.logger.log('Deploying readingContract');
        [this.readingDeploymentReceipt, this.readingInstance] = await this.deployContract(
            this.web3, this.readingContract, this.readingContractData,
            [this.hubInstance._address], accounts[7],
        );

        await this.hubInstance.methods.setReadingAddress(this.readingInstance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        // Deploy tokens.
        const amountToMint = '50000000000000000000000000'; // 5e25
        const amounts = [];
        const recipients = [];
        for (let i = 0; i < accounts.length; i += 1) {
            amounts.push(amountToMint);
            recipients.push(accounts[i]);
        }
        await this.tokenInstance.methods.mintMany(recipients, amounts)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        await this.tokenInstance.methods.finishMinting()
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        this.initialized = true;
    }

    async deployContract(
        web3,
        contract,
        contractData,
        constructorArguments,
        deployerAddress,
    ) {
        let deploymentReceipt;
        let contractInstance;
        return new Promise((accept, reject) => {
            contract.deploy({
                data: contractData,
                arguments: constructorArguments,
            })
                .send({ from: deployerAddress, gas: 6000000 })
                .on('receipt', (receipt) => {
                    deploymentReceipt = receipt;
                })
                .on('error', error => reject(error))
                .then((instance) => {
                    // TODO: ugly workaround - not sure why this is necessary.
                    if (!instance._requestManager.provider) {
                        instance._requestManager.setProvider(web3.eth._provider);
                    }
                    contractInstance = instance;
                    accept([deploymentReceipt, contractInstance]);
                });
        });
    }

    get hubContractAddress() {
        return this.hubInstance._address;
    }

    get profileStorageContractAddress() {
        return this.profileStorageInstance._address;
    }

    get holdingStorageContractAddress() {
        return this.holdingStorageInstance._address;
    }

    get tokenContractAddress() {
        return this.tokenInstance._address;
    }

    get profileContractAddress() {
        return this.profileInstance._address;
    }

    get holdingContractAddress() {
        return this.holdingInstance._address;
    }

    get readingContractAddress() {
        return this.readingInstance._address;
    }

    get isInitialized() {
        return this.initialized;
    }

    static wallets() {
        return wallets;
    }
}

module.exports = LocalBlockchain;
