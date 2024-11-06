import { ApiPromise, WsProvider, HttpProvider } from '@polkadot/api';
import { ethers } from 'ethers';
import {
    BLOCK_TIME_MILLIS,
    NEURO_DEFAULT_GAS_PRICE,
    NODE_ENVIRONMENTS,
} from '../../../../constants/constants.js';
import Web3Service from '../web3-service.js';

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
        // await this.checkEvmWallets();
        await this.parachainProvider.disconnect();
        await super.initialize(config, logger);
    }

    async checkEvmWallets() {
        this.invalidWallets = [];
        for (const wallet of this.config.operationalWallets) {
            // eslint-disable-next-line no-await-in-loop
            const walletMapped = await this.checkEvmAccountMapping(wallet.evmAddress);
            if (!walletMapped) {
                this.invalidWallets.push(wallet);
            }
        }
        if (this.invalidWallets.length === this.config.operationalWallets.length) {
            throw Error('Unable to find mappings for all operational wallets');
        }
        this.invalidWallets.forEach((wallet) =>
            this.logger.warn(
                `Unable to find account mapping for wallet: ${wallet.evmAddress}, wallet removed from the list`,
            ),
        );
        const { evmManagementWalletPublicKey } = this.config;
        const managementWalletMapped = await this.checkEvmAccountMapping(
            evmManagementWalletPublicKey,
        );
        if (!managementWalletMapped) {
            throw Error('Missing account mapping for management wallet');
        }
    }

    async checkEvmAccountMapping(walletPublicKey) {
        const account = await this.queryParachainState('evmAccounts', 'accounts', [
            walletPublicKey,
        ]);
        if (!account || account.toHex() === '0x') {
            return false;
        }
        return true;
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
            const defaultGasPrice =
                process.env.NODE_ENV === NODE_ENVIRONMENTS.MAINNET
                    ? NEURO_DEFAULT_GAS_PRICE.MAINNET
                    : NEURO_DEFAULT_GAS_PRICE.TESTNET;
            return this.convertToWei(defaultGasPrice, 'wei');
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

    async getLatestTokenId(assetContractAddress, blockTag) {
        return this.provider.getStorageAt(
            assetContractAddress.toString().toLowerCase(),
            7,
            blockTag,
        );
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

    async getNativeTokenBalance(wallet) {
        const nativeBalance = await wallet.getBalance();
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
                    (invalidWallet) => invalidWallet.privateKey === wallet.privateKey,
                )
            ) {
                this.logger.warn(
                    `Skipping initialization of wallet. Wallet public key: ${wallet.evmAddress}`,
                );
            } else {
                try {
                    wallets.push(new ethers.Wallet(wallet.privateKey, this.provider));
                } catch (error) {
                    this.logger.warn(
                        `Invalid evm private key, unable to create wallet instance. Wallet public key: ${wallet.evmAddress}. Error: ${error.message}`,
                    );
                }
            }
        });
        return wallets;
    }
}

export default OtParachainService;
