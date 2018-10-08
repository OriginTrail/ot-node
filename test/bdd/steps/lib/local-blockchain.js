const Ganache = require('ganache-core');
const Web3 = require('web3');
const solc = require('solc');
const fs = require('fs');
const path = require('path');
const EthWallet = require('ethereumjs-wallet');

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

const wallets = accountPrivateKeys.map(
    privateKey => ({
        address: `0x${EthWallet.fromPrivateKey(Buffer.from(privateKey, 'hex')).getAddress().toString('hex')}`,
        privateKey,
    }));

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
                this.logger.info('Blockchain is up at http://localhost:7547/');
                this.web3 = new Web3(
                    new Web3.providers.HttpProvider('http://localhost:7545'), // TODO: Use from server.
                );
                this.compileContracts();
                await this.deployContracts();
                accept();
            });
        });
    }

    compileContracts() {
        const tokenSource = fs.readFileSync(
            path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/TracToken.sol'), 'utf8');
        const escrowSource = fs.readFileSync(
            path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/Escrow.sol'), 'utf8');
        const readingSource = fs.readFileSync(
            path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/Reading.sol'), 'utf8');
        const biddingSource = fs.readFileSync(
            path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/Bidding.sol'), 'utf8');
        const otFingerprintSource = fs.readFileSync(
            path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/OTFingerprintStore.sol'), 'utf8');

        let compileResult = solc.compile({ sources: { 'TracToken.sol': tokenSource } }, 1);
        this.tokenContractData = `0x${compileResult.contracts['TracToken.sol:TracToken'].bytecode}`;
        this.tokenContractAbi = JSON.parse(compileResult.contracts['TracToken.sol:TracToken'].interface);
        this.tokenContract = new this.web3.eth.Contract(this.tokenContractAbi);

        compileResult = solc.compile({ sources: { 'Escrow.sol': escrowSource } }, 1);
        this.escrowContractData = `0x${compileResult.contracts['Escrow.sol:EscrowHolder'].bytecode}`;
        this.escrowContractAbi = JSON.parse(compileResult.contracts['Escrow.sol:EscrowHolder'].interface);
        this.escrowContract = new this.web3.eth.Contract(this.escrowContractAbi);

        compileResult = solc.compile({ sources: { 'Reading.sol': readingSource } }, 1);
        this.readingContractData = `0x${compileResult.contracts['Reading.sol:Reading'].bytecode}`;
        this.readingContractAbi = JSON.parse(compileResult.contracts['Reading.sol:Reading'].interface);
        this.readingContract = new this.web3.eth.Contract(this.readingContractAbi);

        compileResult = solc.compile({ sources: { 'Bidding.sol': biddingSource } }, 1);
        this.biddingContractData = `0x${compileResult.contracts['Bidding.sol:Bidding'].bytecode}`;
        this.biddingContractAbi = JSON.parse(compileResult.contracts['Bidding.sol:Bidding'].interface);
        this.biddingContract = new this.web3.eth.Contract(this.biddingContractAbi);

        compileResult = solc.compile({ sources: { 'OTFingerprintStore.sol': otFingerprintSource } }, 1);
        this.otFingerprintContractData = `0x${compileResult.contracts['OTFingerprintStore.sol:OTFingerprintStore'].bytecode}`;
        this.otFingerprintContractAbi = JSON.parse(compileResult.contracts['OTFingerprintStore.sol:OTFingerprintStore'].interface);
        this.otFingerprintContract = new this.web3.eth.Contract(this.otFingerprintContractAbi);
    }

    async deployContracts() {
        const accounts = await this.web3.eth.getAccounts();
        this.logger.debug('Deploying tokenContract');
        [this.tokenDeploymentReceipt, this.tokenInstance] = await this.deployContract(
            this.web3, this.tokenContract, this.tokenContractData,
            [accounts[7], accounts[8], accounts[9]], accounts[7],
        );
        this.logger.debug('Deploying escrowContract');
        [this.escrowDeploymentReceipt, this.escrowInstance] = await this.deployContract(
            this.web3, this.escrowContract, this.escrowContractData,
            [this.tokenInstance._address], accounts[7],
        );
        this.logger.debug('Deploying readingContract');
        [this.readingDeploymentReceipt, this.readingInstance] = await this.deployContract(
            this.web3, this.readingContract, this.readingContractData,
            [this.escrowInstance._address], accounts[7],
        );
        this.logger.debug('Deploying biddingContract');
        [this.biddingDeploymentReceipt, this.biddingInstance] = await this.deployContract(
            this.web3, this.biddingContract, this.biddingContractData,
            [
                this.tokenInstance._address,
                this.escrowInstance._address,
                this.readingInstance._address,
            ], accounts[7],
        );
        this.logger.debug('Deploying otFingerprintContract');
        [this.otFingerprintDeploymentReceipt, this.otFingerprintInstance] = await this.deployContract(
            this.web3, this.otFingerprintContract, this.otFingerprintContractData,
            undefined, accounts[7],
        );

        await this.escrowInstance.methods.setBidding(this.biddingInstance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);
        await this.escrowInstance.methods.setReading(this.readingInstance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);
        await this.readingInstance.methods.setBidding(this.biddingInstance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);
        await this.readingInstance.methods.transferOwnership(this.escrowInstance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);
        await this.escrowInstance.methods.transferOwnership(this.biddingInstance._address)
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

    get otContractAddress() {
        return this.otFingerprintInstance._address;
    }
    get tokenContractAddress() {
        return this.tokenInstance._address;
    }

    get escrowContractAddress() {
        return this.escrowInstance._address;
    }

    get biddingContractAddress() {
        return this.biddingInstance._address;
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
