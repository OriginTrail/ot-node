import { ApiPromise, WsProvider, HttpProvider } from '@polkadot/api';
import { createRequire } from 'module';
import { ethers } from 'ethers';
import { BLOCK_TIME_MILLIS } from '../../../../constants/constants.js';
import Web3Service from '../web3-service.js';

const require = createRequire(import.meta.url);

const ABIs = {
    ContentAssetStorage: require('dkg-evm-module/abi/ContentAssetStorage.json'),
    AssertionStorage: require('dkg-evm-module/abi/AssertionStorage.json'),
    Staking: require('dkg-evm-module/abi/Staking.json'),
    StakingStorage: require('dkg-evm-module/abi/StakingStorage.json'),
    Token: require('dkg-evm-module/abi/Token.json'),
    HashingProxy: require('dkg-evm-module/abi/HashingProxy.json'),
    Hub: require('dkg-evm-module/abi/Hub.json'),
    IdentityStorage: require('dkg-evm-module/abi/IdentityStorage.json'),
    Log2PLDSF: require('dkg-evm-module/abi/Log2PLDSF.json'),
    ParametersStorage: require('dkg-evm-module/abi/ParametersStorage.json'),
    Profile: require('dkg-evm-module/abi/Profile.json'),
    ProfileStorage: require('dkg-evm-module/abi/ProfileStorage.json'),
    ScoringProxy: require('dkg-evm-module/abi/ScoringProxy.json'),
    ServiceAgreementV1: require('dkg-evm-module/abi/ServiceAgreementV1.json'),
    CommitManagerV1: require('dkg-evm-module/abi/CommitManagerV1.json'),
    CommitManagerV1U1: require('dkg-evm-module/abi/CommitManagerV1U1.json'),
    ProofManagerV1: require('dkg-evm-module/abi/ProofManagerV1.json'),
    ProofManagerV1U1: require('dkg-evm-module/abi/ProofManagerV1U1.json'),
    ShardingTable: require('dkg-evm-module/abi/ShardingTableV2.json'),
    ShardingTableStorage: require('dkg-evm-module/abi/ShardingTableStorageV2.json'),
    ServiceAgreementStorageProxy: require('dkg-evm-module/abi/ServiceAgreementStorageProxy.json'),
    UnfinalizedStateStorage: require('dkg-evm-module/abi/UnfinalizedStateStorage.json'),
    LinearSum: require('dkg-evm-module/abi/LinearSum.json'),
};

const NATIVE_TOKEN_DECIMALS = 12;

class OtParachainService extends Web3Service {
    constructor(ctx) {
        super(ctx);

        this.baseTokenTicker = 'OTP';
        this.tracTicker = 'TRAC';
    }

    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;
        this.rpcNumber = 0;
        await this.initializeParachainProvider();
        await this.checkEvmAccountsMapping();
        await this.parachainProvider.disconnect();
        await super.initialize(config, logger);
    }

    getABIs() {
        return ABIs;
    }

    async checkEvmAccountsMapping() {
        const { evmOperationalWalletPublicKey, evmManagementWalletPublicKey } = this.config;
        const operationalAccount = await this.queryParachainState('evmAccounts', 'accounts', [
            evmOperationalWalletPublicKey,
        ]);
        if (!operationalAccount || operationalAccount.toHex() === '0x') {
            throw Error('Missing account mapping for operational wallet');
        }

        const managementAccount = await this.queryParachainState('evmAccounts', 'accounts', [
            evmManagementWalletPublicKey,
        ]);
        if (!managementAccount || managementAccount.toHex() === '0x') {
            throw Error('Missing account mapping for management wallet');
        }
    }

    async callParachainExtrinsic(keyring, extrinsic, method, args) {
        let result;
        while (!result) {
            try {
                // eslint-disable-next-line no-await-in-loop
                result = this.parachainProvider.tx[extrinsic][method](...args).signAndSend(keyring);

                return result;
            } catch (error) {
                // eslint-disable-next-line no-await-in-loop
                await this.handleParachainError(error, method);
            }
        }
    }

    async queryParachainState(state, method, args) {
        let result;
        while (!result) {
            try {
                // eslint-disable-next-line no-await-in-loop
                result = await this.parachainProvider.query[state][method](...args);

                return result;
            } catch (error) {
                // eslint-disable-next-line no-await-in-loop
                await this.handleParachainError(error, method);
            }
        }
    }

    async initializeParachainProvider() {
        let tries = 0;
        let isRpcConnected = false;
        while (!isRpcConnected) {
            if (tries >= this.config.rpcEndpoints.length) {
                throw Error(
                    'Blockchain initialisation failed, unable to initialize parachain provider!',
                );
            }

            try {
                let provider;
                if (this.config.rpcEndpoints[this.rpcNumber].startsWith('ws')) {
                    provider = new WsProvider(this.config.rpcEndpoints[this.rpcNumber]);
                } else {
                    provider = new HttpProvider(this.config.rpcEndpoints[this.rpcNumber]);
                }
                // eslint-disable-next-line no-await-in-loop
                this.parachainProvider = await new ApiPromise({ provider }).isReadyOrError;
                isRpcConnected = true;
            } catch (e) {
                this.logger.warn(
                    `Unable to create parachain provider for endpoint : ${
                        this.config.rpcEndpoints[this.rpcNumber]
                    }. Error: ${e.message}`,
                );
                tries += 1;
                this.rpcNumber = (this.rpcNumber + 1) % this.config.rpcEndpoints.length;
            }
        }
    }

    async getGasPrice() {
        if (this.config.gasPriceOracleLink) return super.getGasPrice();

        try {
            return this.provider.getGasPrice();
        } catch (error) {
            return undefined;
        }
    }

    async handleParachainError(error, method) {
        let isRpcError = false;
        try {
            await this.parachainProvider.rpc.net.listening();
        } catch (rpcError) {
            isRpcError = true;
            this.logger.warn(
                `Unable to execute substrate method ${method} using blockchain rpc : ${
                    this.config.rpcEndpoints[this.rpcNumber]
                }.`,
            );
            await this.restartParachainProvider();
        }
        if (!isRpcError) throw error;
    }

    async restartParachainProvider() {
        this.rpcNumber = (this.rpcNumber + 1) % this.config.rpcEndpoints.length;
        this.logger.warn(
            `There was an issue with current parachain provider. Connecting to ${
                this.config.rpcEndpoints[this.rpcNumber]
            }`,
        );
        await this.initializeParachainProvider();
    }

    async getNativeTokenBalance() {
        const nativeBalance = await this.wallet.getBalance();
        return nativeBalance / 10 ** NATIVE_TOKEN_DECIMALS;
    }

    getBlockTimeMillis() {
        return BLOCK_TIME_MILLIS.OTP;
    }

    getValidOperationalWallets() {
        const wallets = [];
        this.config.operationalWallets.forEach((wallet) => {
            if (
                this.invalidWallets?.find(
                    (invalidWallet) => invalidWallet.evmPrivateKey === wallet.evmPrivateKey,
                )
            ) {
                this.logger.warn(
                    `Skipping initialization of wallet. Wallet public key: ${wallet.evmPublicKey}`,
                );
            } else {
                try {
                    wallets.push(new ethers.Wallet(wallet.evmPrivateKey, this.provider));
                } catch (error) {
                    this.logger.warn(
                        `Invalid evm private key, unable to create wallet instance. Wallet public key: ${wallet.evmPublicKey}. Error: ${error.message}`,
                    );
                }
            }
        });
        return wallets;
    }
}

export default OtParachainService;
