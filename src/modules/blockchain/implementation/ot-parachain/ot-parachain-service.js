const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');
const Web3Service = require('../web3-service');

class OtParachainService extends Web3Service {
    constructor(ctx) {
        super(ctx);

        this.baseTokenTicker = 'OTP';
        this.tracTicker = 'pTRAC';
    }

    async initialize(config, logger) {
        await super.initialize(config, logger);

        await this.initializeParachainProvider();

        const { operationalAccount, managementAccount } =
            await this.getOperationalAndManagementAccount();

        const keyring = new Keyring({ type: 'sr25519' });
        this.operationalKeyring = keyring.createFromUri(
            this.config.substrateOperationalWalletPrivateKey,
        );
        this.managementKeyring = keyring.createFromUri(
            this.config.substrateManagementWalletPrivateKey,
        );

        this.evmOperationalAccount = operationalAccount;
        this.evmManagementAccount = managementAccount;
    }

    async getOperationalAndManagementAccount() {
        const {
            substrateOperationalWalletPublicKey,
            substrateManagementWalletPublicKey,
            evmOperationalWalletPublicKey,
            evmOperationalWalletPrivateKey,
            evmManagementWalletPublicKey,
            evmManagementWalletPrivateKey,
        } = this.config;

        let operationalAccount = await this.queryParachainState('evmAccounts', 'accounts', [
            substrateOperationalWalletPublicKey,
        ]);

        if (!operationalAccount) {
            const signature = await this.generateSignatureForMappingCall(
                evmOperationalWalletPublicKey,
                evmOperationalWalletPrivateKey,
            );
            operationalAccount = await this.callParachainExtrinsic(
                this.operationalKeyring,
                'evmAccounts',
                'claimAccount',
                [evmOperationalWalletPublicKey, signature],
            );
        }

        let managementAccount = await this.queryParachainState('evmAccounts', 'accounts', [
            substrateManagementWalletPublicKey,
        ]);

        if (!managementAccount) {
            const signature = await this.generateSignatureForMappingCall(
                evmManagementWalletPublicKey,
                evmManagementWalletPrivateKey,
            );
            managementAccount = await this.callParachainExtrinsic(
                this.managementKeyring,
                'evmAccounts',
                'claimAccount',
                [evmManagementWalletPublicKey, signature],
            );
        }

        if (!operationalAccount || !managementAccount) {
            throw new Error(`Unable to create account mapping for otp`);
        }
        return {
            operationalAccount,
            managementAccount,
        };
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

    async generateSignatureForMappingCall(publicKey, privateKey) {
        const result = await this.web3.eth.accounts.sign(publicKey, privateKey);
        return result.signature;
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
                // Initialise the provider to connect to the local node
                const provider = new WsProvider(this.config.rpcEndpoints[this.rpcNumber]);

                // eslint-disable-next-line no-await-in-loop
                this.parachainProvider = await ApiPromise.create({ provider });
                isRpcConnected = true;
            } catch (e) {
                this.logger.warn(
                    `Unable to create parachain provider for endpoint : ${
                        this.config.rpcEndpoints[this.rpcNumber]
                    }.`,
                );
                tries += 1;
                this.rpcNumber = (this.rpcNumber + 1) % this.config.rpcEndpoints.length;
            }
        }
    }

    async getGasPrice() {
        if (this.config.gasPriceOracleLink) return super.getGasPrice();

        try {
            return this.web3.eth.getGasPrice();
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
}

module.exports = OtParachainService;
