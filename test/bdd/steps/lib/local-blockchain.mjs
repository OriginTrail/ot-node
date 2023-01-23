/* eslint-disable max-len */
import Ganache from 'ganache';
import { ethers } from "ethers";
import { readFile } from 'fs/promises';

const hub = JSON.parse(await readFile('node_modules/dkg-evm-module/build/contracts/Hub.json'));
const shardingTable = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/ShardingTable.json'),
);
const staking = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/Staking.json'),
);
const shardingTableStorage = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/ShardingTableStorage.json'),
);
const assertionStorage = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/AssertionStorage.json'),
);
const hashingProxy = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/HashingProxy.json'),
);
const identity = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/Identity.json'),
);
const identityStorage = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/IdentityStorage.json'),
);
const parametersStorage = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/ParametersStorage.json'),
);
const scoringProxy = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/ScoringProxy.json'),
);
const serviceAgreementStorageV1 = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/ServiceAgreementStorageV1.json'),
);
const serviceAgreementV1 = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/ServiceAgreementV1.json'),
);
const sha256Contract = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/SHA256.json'),
);
const log2pldsfContract = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/Log2PLDSF.json'),
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
const assertion = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/Assertion.json'),
);
const stakingStorage = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/StakingStorage.json'),
);
const whitelistStorage = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/WhitelistStorage.json'),
);
const contentAsset = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/ContentAsset.json')
)
const contentAssetStorage = JSON.parse(
    await readFile('node_modules/dkg-evm-module/build/contracts/ContentAssetStorage.json')
)

const accountPrivateKeys = JSON.parse(
    await readFile('test/bdd/steps/api/datasets/privateKeys.json'),
);

const sources = {
    hub,
    assertion,
    stakingStorage,
    shardingTable,
    assertionStorage,
    shardingTableStorage,
    serviceAgreementV1,
    erc20Token,
    profileStorage,
    profile,
    hashingProxy,
    identityStorage,
    parametersStorage,
    scoringProxy,
    serviceAgreementStorageV1,
    sha256Contract,
    log2pldsfContract,
    staking,
    identity,
    whitelistStorage,
    contentAsset,
    contentAssetStorage
};

const testParametersStorageParams = {
    epochLength: 6*60, // 6 minutes
    commitWindowDurationPerc: 33, // 2 minutes
    minProofWindowOffsetPerc: 66, // 4 minutes
    maxProofWindowOffsetPerc: 66, // 4 minutes
    proofWindowDurationPerc: 33, // 2 minutes
}
/**
 * LocalBlockchain represent small wrapper around the Ganache.
 *
 * LocalBlockchain uses the Ganache-core to run in-memory blockchain simulator. It uses
 * predefined accounts that can be fetch by calling LocalBlockchain.wallets(). Account with
 * index 7 is used for deploying contracts.
 *
 * Basic usage:
 * LocalBlockchain.wallets()[9].instance.address
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
        const logging = options.logger ? {
            logger: {
                log: this.logger.log,
            }
        } : {
            quiet: true,
        };
        this.port = options.port ?? 7545;
        this.name = options.name ?? 'ganache';
        this.server = Ganache.server({
            /* miner: {
                blockTime: 1,
            }, */
            logging,
            gas: 20000000,
            time: new Date(),
            accounts: accountPrivateKeys.map((account) => ({
                secretKey: `0x${account}`,
                balance: ethers.utils.parseEther('1000000').toHexString(),
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
                this.provider = new ethers.providers.JsonRpcProvider(`http://localhost:${this.port}`);
                this.wallets = accountPrivateKeys.map((privateKey) => ({
                    instance: new ethers.Wallet(privateKey, this.provider),
                    privateKey,
                }));
                // eslint-disable-next-line prefer-destructuring
                this.deployingWallet = this.wallets[0];
                this.fetchContracts();
                await this.deployContracts();
                this.logger.info('Contracts have been deployed!');
                this.logger.info(
                    `\t Hub contract address: \t\t\t\t\t${this.contracts.hub.instance.address}`,
                );
                this.logger.info(
                    `\t Staking contract address: \t\t\t\t\t${this.contracts.staking.instance.address}`,
                );
                this.logger.info(
                    `\t StakingStorage contract address: \t\t\t\t\t${this.contracts.stakingStorage.instance.address}`,
                );
                this.logger.info(
                    `\t Sharding table contract address: \t\t\t${this.contracts.shardingTable.instance.address}`,
                );
                this.logger.info(
                    `\t ShardingTableStorage contract address: \t\t\t${this.contracts.shardingTableStorage.instance.address}`,
                );
                this.logger.info(
                    `\t Assertion contract address: \t\t\t${this.contracts.assertion.instance.address}`,
                );
                this.logger.info(
                    `\t AssertionStorage contract address: \t\t\t${this.contracts.assertionStorage.instance.address}`,
                );
                this.logger.info(
                    `\t Hashing Proxy contract address: \t\t\t\t${this.contracts.hashingProxy.instance.address}`,
                );
                this.logger.info(
                    `\t Identity contract address: \t\t\t\t${this.contracts.identity.instance.address}`,
                );
                this.logger.info(
                    `\t Identity Storage contract address: \t\t\t\t${this.contracts.identityStorage.instance.address}`,
                );
                this.logger.info(
                    `\t Parameters Storage contract address: \t\t\t\t${this.contracts.parametersStorage.instance.address}`,
                );
                this.logger.info(
                    `\t Whitelist Storage contract address: \t\t\t\t${this.contracts.whitelistStorage.instance.address}`,
                );
                this.logger.info(
                    `\t Scoring Proxy contract address: \t\t\t\t${this.contracts.scoringProxy.instance.address}`,
                );
                this.logger.info(
                    `\t Service Agreement Storage V1 contract address: \t\t\t\t${this.contracts.serviceAgreementStorageV1.instance.address}`,
                );
                this.logger.info(
                    `\t Service Agreement V1 contract address: \t\t\t\t${this.contracts.serviceAgreementV1.instance.address}`,
                );
                this.logger.info(
                    `\t Token contract address: \t\t\t\t${this.contracts.erc20Token.instance.address}`,
                );
                this.logger.info(
                    `\t ProfileStorage contract address: \t\t\t${this.contracts.profileStorage.instance.address}`,
                );
                this.logger.info(
                    `\t Profile contract address: \t\t\t\t${this.contracts.profile.instance.address}`,
                );
                this.logger.info(
                    `\t ContentAsset contract address: \t\t\t\t${this.contracts.contentAsset.instance._address}`,
                );
                this.logger.info(
                    `\t ContentAsset Storage contract address: \t\t\t\t${this.contracts.contentAssetStorage.instance._address}`,
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
    }

    async deployContracts() {
        await this.deploy('hub');
        await this.setContractAddress('Owner', this.deployingWallet.instance.address);

        await this.deploy('erc20Token', [this.contracts.hub.instance.address]);
        await this.setContractAddress('Token', this.contracts.erc20Token.instance.address);
        await this.setupRole(this.contracts.erc20Token, this.deployingWallet.instance.address);

        await this.deploy('parametersStorage', [this.contracts.hub.instance.address]);
        await this.setContractAddress('ParametersStorage', this.contracts.parametersStorage.instance.address);

        await this.setParametersStorageParams(testParametersStorageParams, this.deployingWallet.instance.address);

        await this.deploy('whitelistStorage', [this.contracts.hub.instance.address]);
        await this.setContractAddress('WhitelistStorage', this.contracts.whitelistStorage.instance.address);

        await this.deploy('hashingProxy', [this.contracts.hub.instance.address]);
        await this.setContractAddress('HashingProxy', this.contracts.hashingProxy.instance.address);

        await this.deploy('scoringProxy', [this.contracts.hub.instance.address]);
        await this.setContractAddress('ScoringProxy', this.contracts.scoringProxy.instance.address);

        await this.deploy('sha256Contract');

        await this.setHashFunctionContractAddress(1, this.contracts.sha256Contract.instance.address);

        await this.deploy('log2pldsfContract', [this.contracts.hub.instance.address]);
        await this.setScoreFunctionContractAddress(1, this.contracts.log2pldsfContract.instance.address);

        await this.deploy('stakingStorage', [this.contracts.hub.instance.address]);
        await this.setContractAddress('StakingStorage', this.contracts.stakingStorage.instance.address);

        await this.deploy('shardingTableStorage', [this.contracts.hub.instance.address]);
        await this.setContractAddress('ShardingTableStorage', this.contracts.shardingTableStorage.instance.address);

        await this.deploy('assertionStorage', [this.contracts.hub.instance.address]);
        await this.setContractAddress('AssertionStorage', this.contracts.assertionStorage.instance.address);

        await this.deploy('serviceAgreementStorageV1', [this.contracts.hub.instance.address]);
        await this.setContractAddress(
            'ServiceAgreementStorageV1',
            this.contracts.serviceAgreementStorageV1.instance.address,
        );

        await this.deploy('contentAssetStorage', [this.contracts.hub.instance.address]);
        await this.setAssetStorageContractAddress(
            'ContentAssetStorage',
            this.contracts.contentAssetStorage.instance.address,
        )

        await this.deploy('identityStorage', [this.contracts.hub.instance.address]);
        await this.setContractAddress('IdentityStorage', this.contracts.identityStorage.instance.address);

        await this.deploy('profileStorage', [this.contracts.hub.instance.address]);
        await this.setContractAddress('ProfileStorage', this.contracts.profileStorage.instance.address);

        await this.deploy('assertion', [this.contracts.hub.instance.address]);
        await this.setContractAddress('Assertion', this.contracts.assertion.instance.address);

        await this.deploy('identity', [this.contracts.hub.instance.address]);
        await this.setContractAddress('Identity', this.contracts.identity.instance.address);

        await this.deploy('shardingTable', [this.contracts.hub.instance.address]);
        await this.setContractAddress('ShardingTable', this.contracts.shardingTable.instance.address);

        await this.deploy('staking', [this.contracts.hub.instance.address]);
        await this.setContractAddress('Staking', this.contracts.staking.instance.address);

        await this.deploy('profile', [this.contracts.hub.instance.address]);
        await this.setContractAddress('Profile', this.contracts.profile.instance.address);

        await this.deploy('serviceAgreementV1', [this.contracts.hub.instance.address]);
        await this.setContractAddress(
            'ServiceAgreementV1',
            this.contracts.serviceAgreementV1.instance.address,
        );

        await this.deploy('contentAsset', [this.contracts.hub.instance.address]);
        await this.setContractAddress('ContentAsset', this.contracts.contentAsset.instance.address);

        // Mint tokens.
        const amountToMint = ethers.utils.parseEther('50000000');
        for (let i = 0; i < this.wallets.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            await this.contracts.erc20Token.instance
                .mint(this.wallets[i].instance.address, amountToMint, { gasLimit: 3000000 })
                .catch((error) => this.logger.error('Minting error: ', error));
        }
        this.initialized = true;
    }

    async deploy(contractName, constructorArgs = []) {
        const contractFactory = new ethers.ContractFactory(
            this.contracts[contractName].abi,
            this.contracts[contractName].data,
            this.deployingWallet.instance
        );
        const contractInstance = await contractFactory.deploy(
            ...constructorArgs,
            { gasLimit: 6900000 }
        );
        
        this.contracts[contractName].deploymentReceipt = contractInstance.deployTransaction;
        this.contracts[contractName].instance = contractInstance;
    }

    async setContractAddress(contractName, contractAddress) {
        return this.contracts.hub.instance
            .setContractAddress(contractName, contractAddress, { gasLimit: 3000000 })
            .catch((error) =>
                this.logger.error(
                    `Unable to set contract ${contractName} address in HUB. Error: `,
                    error,
                ),
            );
    }

    async setParametersStorageParams(params) {
        for (const parameter of Object.keys(params)) {
            const blockchainMethodName = `set${parameter.charAt(0).toUpperCase() + parameter.slice(1)}`;
            this.logger.info(`Setting ${parameter} in parameters storage to: ${params[parameter]}`)
            // eslint-disable-next-line no-await-in-loop
            await this.contracts.parametersStorage.instance[blockchainMethodName](
                params[parameter],
                { gasLimit: 50000 },
            );
        }
    }

    async setAssetStorageContractAddress(contractName, contractAddress) {
        return this.contracts.hub.instance
            .setAssetStorageAddress(contractName, contractAddress, { gasLimit: 3000000 })
            .catch((error) =>
                this.logger.error(
                    `Unable to set asset storage contract ${contractName} address in HUB. Error: `,
                    error,
                ),
            );
    }

    async setR1(r1) {
        return this.contracts.parametersStorage.instance
            .setR1(r1, { gasLimit: 3000000 })
            .catch((error) =>
                this.logger.error(`Unable to set R1 in parameters storage. Error: `, error),
            );
    }

    async setR2(r2) {
        return this.contracts.parametersStorage.instance
            .setR2(r2, { gasLimit: 3000000 })
            .catch((error) =>
                this.logger.error(`Unable to set R2 in parameters storage. Error: `, error),
            );
    }

    async setHashFunctionContractAddress(hashFunctionId, contractAddress) {
        return this.contracts.hashingProxy.instance
            .setContractAddress(hashFunctionId, contractAddress, { gasLimit: 3000000 })
            .catch((error) =>
                this.logger.error(
                    `Unable to set hash function contract ${hashFunctionId} address in HashingProxy contract. Error: `,
                    error,
                ),
            );
    }

    async setScoreFunctionContractAddress(scoreFunctionId, contractAddress) {
        return this.contracts.scoringProxy.instance
            .setContractAddress(scoreFunctionId, contractAddress, { gasLimit: 3000000 })
            .catch((error) =>
                this.logger.error(
                    `Unable to set score function contract ${scoreFunctionId} address in ScoringProxy contract. Error: `,
                    error,
                ),
            );
    }

    async getContractAddress(hubContract, contractName) {
        return hubContract.getContractAddress(contractName);
    }

    async getAssetStorageAddress(hubContract, contractName) {
        return hubContract.getAssetStorageAddress(contractName);
    }

    async getHashFunctionContractAddress(hashingProxyContract, hashFunctionId) {
        return hashingProxyContract.functions(hashFunctionId);
    }

    async getScoreFunctionContractAddress(scoringProxyContract, scoreFunctionId) {
        return scoringProxyContract.functions(scoreFunctionId);
    }

    async setupRole(contract, minter) {
        await contract.instance
            .setupRole(minter, { gasLimit: 3000000 })
            .catch((error) => this.logger.error('Unable to setup role. Error: ', error));
    }
}

export default LocalBlockchain;
