const { ApiPromise, WsProvider } = require('@polkadot/api');
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

        this.operationalAccount = operationalAccount;
        this.managementAccount = managementAccount;
    }

    async getOperationalAndManagementAccount() {
        const {
            operationalWalletPublicKey,
            operationalWalletPrivateKey,
            managementWalletPublicKey,
            managementWalletPrivateKey,
        } = this.config;

        let operationalAccount = await this.queryParachainState('evmAccounts', 'accounts', [
            operationalWalletPublicKey,
        ]);

        if (!operationalAccount) {
            const signature = await this.generateSignatureForMappingCall(
                operationalWalletPublicKey,
                operationalWalletPrivateKey,
            );
            operationalAccount = await this.callParachainExtrinsic('evmAccounts', 'claimAccount', [
                operationalWalletPublicKey,
                signature,
            ]);
        }

        let managementAccount = await this.queryParachainState('evmAccounts', 'accounts', [
            managementWalletPublicKey,
        ]);

        if (!managementAccount) {
            const signature = await this.generateSignatureForMappingCall(
                managementWalletPublicKey,
                managementWalletPrivateKey,
            );
            managementAccount = await this.callParachainExtrinsic('evmAccounts', 'claimAccount', [
                managementWalletPublicKey,
                signature,
            ]);
        }

        if (!operationalAccount || !managementAccount) {
            throw new Error(`Unable to create account mapping for otp`);
        }
        return {
            operationalAccount,
            managementAccount,
        };
    }

    async callParachainExtrinsic(extrinsic, method, args) {
        // add error handling for rpc error
        return this.parachainProvider.tx[extrinsic][method](...args);
    }

    async queryParachainState(state, method, args) {
        // add error handling for rpc error
        return this.parachainProvider.query[state][method](...args);
    }

    async generateSignatureForMappingCall(publicKey, privateKey) {
        const result = await this.web3.eth.accounts.sign(publicKey, privateKey);
        return result.signature;
    }

    async initializeParachainProvider() {
        let tries = 0;
        let isParachainProviderConnected = false;
        while (!isParachainProviderConnected) {
            if (tries >= this.config.rpcEndpoints.length) {
                throw Error(
                    'Blockchain initialisation failed, unable to initialize parachain provider!',
                );
            }

            try {
                // Initialise the provider to connect to the local node
                const provider = new WsProvider(
                    this.config.rpcEndpoints[this.parachainProviderRpcNumber],
                );

                // eslint-disable-next-line no-await-in-loop
                this.parachainProvider = await ApiPromise.create({ provider });
                isParachainProviderConnected = true;
            } catch (e) {
                this.logger.warn(
                    `Unable to create parachain provider for endpoint : ${
                        this.config.rpcEndpoints[this.parachainProviderRpcNumber]
                    }.`,
                );
                tries += 1;
                this.parachainProviderRpcNumber =
                    (this.parachainProviderRpcNumber + 1) % this.config.rpcEndpoints.length;
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
}

module.exports = OtParachainService;
