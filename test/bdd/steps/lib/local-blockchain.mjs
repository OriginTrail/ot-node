/* eslint-disable max-len */
import Ganache from 'ganache';
import Web3 from 'web3';
import { readFile } from 'fs/promises';

const hub = JSON.parse(await readFile('node_modules/dkg-evm-module/build/contracts/Hub.json'));
const shardingTable = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/ShardingTable.json'),
);
const assertionRegistry = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/AssertionRegistry.json'),
);
const contentAsset = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/ContentAsset.json')
);
const hashingProxy = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/HashingProxy.json')
);
const identityStorage = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/IdentityStorage.json')
);
const parametersStorage = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/ParametersStorage.json')
)
const scoringProxy = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/ScoringProxy.json')
);
const serviceAgreementStorage = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/ServiceAgreementStorage.json')
);
const sha256Contract = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/SHA256.json')
);
const pldsfContract = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/PLDSF.json')
);
const erc20Token = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/ERC20Token.json'),
);
const profile = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/Profile.json'),
);
const profileStorage = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/ProfileStorage.json'),
);
const accountPrivateKeys = JSON.parse(
    await readFile('test/bdd/steps/api/datasets/privateKeys.json'),
);

const sources = {
    hub,
    shardingTable,
    assertionRegistry,
    erc20Token,
    profileStorage,
    profile,
    contentAsset,
    hashingProxy,
    identityStorage,
    parametersStorage,
    scoringProxy,
    serviceAgreementStorage,
    sha256Contract,
    pldsfContract
};
const web3 = new Web3();
const wallets = accountPrivateKeys.map((privateKey) => ({
    address: web3.eth.accounts.privateKeyToAccount(privateKey).address,
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
        this.logger = options.logger ?? console;
        this.port = options.port ?? 7545;
        this.name = options.name ?? 'ganache';
        this.server = Ganache.server({
            logging: {
                logger: {
                    log: () => {},
                },
            },
            gasLimit: 7000000,
            time: new Date(),
            accounts: accountPrivateKeys.map((account) => ({
                secretKey: `0x${account}`,
                balance: `0x${Web3.utils.toWei('100', 'ether').toString('hex')}`,
            })),
        });
        this.initialized = false;
    }

    async initialize() {
        return new Promise((accept, reject) => {
            this.server.listen(this.port, async (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                this.logger.info(`Blockchain is up at http://localhost:${this.port}/`);
                this.web3 = new Web3(
                    new Web3.providers.HttpProvider(`http://localhost:${this.port}`),
                );
                this.fetchContracts();
                await this.deployContracts();
                this.logger.info('Contracts have been deployed!');
                this.logger.info(
                    `\t Hub contract address: \t\t\t\t\t${this.contracts.hub.instance._address}`,
                );
                this.logger.info(
                    `\t Sharding table contract address: \t\t\t${this.contracts.shardingTable.instance._address}`,
                );
                this.logger.info(
                    `\t AssertionRegistry contract address: \t\t\t${this.contracts.assertionRegistry.instance._address}`,
                );
                this.logger.info(
                    `\t Content Asset contract address: \t\t\t\t${this.contracts.contentAsset.instance._address}`,
                );
                this.logger.info(
                    `\t Hashing Proxy contract address: \t\t\t\t${this.contracts.hashingProxy.instance._address}`,
                );
                this.logger.info(
                    `\t Identity Storage contract address: \t\t\t\t${this.contracts.identityStorage.instance._address}`,
                );
                this.logger.info(
                    `\t Parameters Storage contract address: \t\t\t\t${this.contracts.parametersStorage.instance._address}`,
                );
                this.logger.info(
                    `\t Scoring Proxy contract address: \t\t\t\t${this.contracts.scoringProxy.instance._address}`,
                );
                this.logger.info(
                    `\t Service Agreement Storage contract address: \t\t\t\t${this.contracts.serviceAgreementStorage.instance._address}`,
                );
                this.logger.info(
                    `\t Token contract address: \t\t\t\t${this.contracts.erc20Token.instance._address}`,
                );
                this.logger.info(
                    `\t ProfileStorage contract address: \t\t\t${this.contracts.profileStorage.instance._address}`,
                );
                this.logger.info(
                    `\t Profile contract address: \t\t\t\t${this.contracts.profile.instance._address}`,
                );
                accept();
            });
        });
    }

    fetchContracts() {
        this.contracts = {};
        for (const [name, source] of Object.entries(sources)) {
            this.populateContractObject(name, source);
        }
    }

    populateContractObject(contractName, source) {
        this.contracts[contractName] = {};
        this.contracts[contractName].data = source.bytecode;
        this.contracts[contractName].abi = source.abi;
        this.contracts[contractName].artifact = new this.web3.eth.Contract(
            this.contracts[contractName].abi,
        );
    }

    async deployContracts() {
        const deployingWallet = this.getWallets()[0];

        await this.deploy('hub', deployingWallet, []);
        await this.setContractAddress('Owner', deployingWallet.address, deployingWallet);

        await this.deploy('parametersStorage', deployingWallet, []);
        await this.setContractAddress(
            'ParametersStorage',
            this.contracts.parametersStorage.instance._address,
            deployingWallet
        );

        await this.deploy('hashingProxy', deployingWallet, []);
        await this.setContractAddress(
            'HashingProxy',
            this.contracts.hashingProxy.instance._address,
            deployingWallet
        );

        await this.deploy('sha256Contract', deployingWallet, []);

        await this.setHashFunctionContractAddress(
            0,
            this.contracts.sha256Contract.instance._address,
            deployingWallet
        );

        await this.deploy('scoringProxy', deployingWallet, []);
        await this.setContractAddress(
            'ScoringProxy',
            this.contracts.scoringProxy.instance._address,
            deployingWallet
        );

        await this.deploy('pldsfContract', deployingWallet, [this.contracts.hub.instance._address]);
        await this.setScoringFunctionContractAddress(
            0,
            this.contracts.pldsfContract.instance._address,
            deployingWallet
        );

        await this.deploy('shardingTable', deployingWallet, [this.contracts.hub.instance._address]);
        await this.setContractAddress(
            'ShardingTable',
            this.contracts.shardingTable.instance._address,
            deployingWallet,
        );

        await this.deploy('assertionRegistry', deployingWallet, [
            this.contracts.hub.instance._address,
        ]);
        await this.setContractAddress(
            'AssertionRegistry',
            this.contracts.assertionRegistry.instance._address,
            deployingWallet,
        );

        await this.deploy('serviceAgreementStorage', deployingWallet, [
            this.contracts.hub.instance._address,
        ]);
        await this.setContractAddress(
            'ServiceAgreementStorage',
            this.contracts.serviceAgreementStorage.instance._address,
            deployingWallet,
        );

        await this.deploy('contentAsset', deployingWallet, [this.contracts.hub.instance._address]);
        await this.setAssetContractAddress(
            'ContentAsset',
            this.contracts.contentAsset.instance._address,
            deployingWallet
        );

        await this.deploy('identityStorage', deployingWallet, [this.contracts.hub.instance._address]);
        await this.setContractAddress(
            'IdentityStorage',
            this.contracts.identityStorage.instance._address,
            deployingWallet
        );

        await this.deploy('profileStorage', deployingWallet, [
            this.contracts.hub.instance._address,
        ]);
        await this.setContractAddress(
            'ProfileStorage',
            this.contracts.profileStorage.instance._address,
            deployingWallet,
        );

        await this.deploy('erc20Token', deployingWallet, [this.contracts.hub.instance._address]);
        await this.setContractAddress(
            'Token',
            this.contracts.erc20Token.instance._address,
            deployingWallet,
        );
        await this.setupRole(this.contracts.erc20Token, deployingWallet.address);

        await this.deploy('profile', deployingWallet, [this.contracts.hub.instance._address]);
        await this.setContractAddress(
            'Profile',
            this.contracts.profile.instance._address,
            deployingWallet,
        );

        // // Deploy tokens.
        const amountToMint = '50000000000000000000000000'; // 5e25
        for (let i = 0; i < this.getWallets().length; i += 1) {
            this.contracts.erc20Token.instance.methods
                .mint(this.getWallets()[i].address, amountToMint)
                .send({ from: deployingWallet.address, gas: 3000000 })
                .on('error', (error) => this.logger.error('Minting error: ', error));
        }
        this.initialized = true;
    }

    async deploy(contractName, deployingWallet, constructorArgs) {
        [this.contracts[contractName].deploymentReceipt, this.contracts[contractName].instance] =
            await this._deployContract(
                this.web3,
                this.contracts[contractName].artifact,
                this.contracts[contractName].data,
                constructorArgs,
                deployingWallet.address,
            );
    }

    async _deployContract(web3_, contract, contractData, constructorArguments, deployerAddress) {
        let deploymentReceipt;
        let contractInstance;
        return new Promise((accept, reject) => {
            contract
                .deploy({
                    data: contractData,
                    arguments: constructorArguments,
                })
                .send({ from: deployerAddress, gas: 6900000 })
                .on('receipt', (receipt) => {
                    deploymentReceipt = receipt;
                })
                .on('error', (error) => reject(error))
                .then((instance) => {
                    // TODO: ugly workaround - not sure why this is necessary.
                    if (!instance._requestManager.provider) {
                        instance._requestManager.setProvider(web3_.eth._provider);
                    }
                    contractInstance = instance;
                    accept([deploymentReceipt, contractInstance]);
                });
        });
    }

    async setContractAddress(contractName, contractAddress, sendingWallet) {
        return this.contracts.hub.instance.methods
            .setContractAddress(contractName, contractAddress)
            .send({ from: sendingWallet.address, gas: 3000000 })
            .on('error', (error) =>
                this.logger.error(
                    `Unable to set contract ${contractName} address in HUB. Error: `,
                    error,
                ),
            );
    }

    async setAssetContractAddress(contractName, contractAddress, sendingWallet) {
        return this.contracts.hub.instance.methods
            .setAssetContractAddress(contractName, contractAddress)
            .send({ from: sendingWallet.address, gas: 3000000 })
            .on('error', (error) =>
                this.logger.error(
                    `Unable to set asset contract ${contractName} address in HUB. Error: `,
                    error,
                ),
            );
    }

    async setHashFunctionContractAddress(hashFunctionId, contractAddress, sendingWallet) {
        return this.contracts.hashingProxy.instance.methods
            .setContractAddress(hashFunctionId, contractAddress)
            .send({ from: sendingWallet.address, gas: 3000000 })
            .on('error', (error) =>
                this.logger.error(
                    `Unable to set hashing function contract ${hashFunctionId} address in HashingProxy contract. Error: `,
                    error,
                ),
            );
    }

    async setScoringFunctionContractAddress(scoringFunctionId, contractAddress, sendingWallet) {
        return this.contracts.scoringProxy.instance.methods
            .setContractAddress(scoringFunctionId, contractAddress)
            .send({ from: sendingWallet.address, gas: 3000000 })
            .on('error', (error) =>
                this.logger.error(
                    `Unable to set scoring function contract ${scoringFunctionId} address in ScoringProxy contract. Error: `,
                    error,
                ),
            );
    }

    async getContractAddress(hubContract, contractName) {
        // this.logger.info(`Attempting to get ${contractName} contract address from Hub contract`);
        return hubContract.methods
            .getContractAddress(contractName)
            .call({ from: this.getWallets()[0].address });
    }

    async getAssetContractAddress(hubContract, contractName) {
        return hubContract.methods
            .getContractAddress(contractName)
            .call({ from: this.getWallets()[0].address });
    }

    async getHashFunctionContractAddress(hashingProxyContract, hashFunctionId) {
        return hashingProxyContract.methods
            .functions(hashFunctionId)
            .call({ from: this.getWallets()[0].address });
    }

    async getScoringFunctionContractAddress(scoringProxyContract, scoringFunctionId) {
        return scoringProxyContract.methods
            .functions(scoringFunctionId)
            .call({ from: this.getWallets()[0].address });
    }

    async setupRole(contract, contractAddress) {
        // this.logger.info(`Setting role for address: ${contract.instance._address}`);
        contract.instance.methods
            .setupRole(contractAddress)
            .send({ from: this.getWallets()[0].address, gas: 3000000 })
            .on('error', (error) => this.logger.error('Unable to setup role. Error: ', error));
    }

    getHubAddress() {
        return this.contracts.hub.instance._address;
    }

    getHashingProxyAddress() {
        return this.contracts.hashingProxy.instance._address;
    }

    getScoringProxyAddress() {
        return this.contracts.scoringProxy.instance._address;
    }

    isInitialized() {
        return this.initialized;
    }

    getWallets() {
        return wallets;
    }

    async getBalanceInEthers(wallet) {
        return this.web3.eth.getBalance(wallet);
    }
}

export default LocalBlockchain;
