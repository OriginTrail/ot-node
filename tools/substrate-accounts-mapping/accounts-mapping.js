/* eslint-disable no-await-in-loop */
const fs = require('fs');
const { WsProvider, ApiPromise } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');
const { mnemonicGenerate, mnemonicToMiniSecret } = require('@polkadot/util-crypto');
const { u8aToHex } = require('@polkadot/util');
const Web3 = require('web3');
const keys = require('./wallets.json');

const endpoint = 'wss://parachain-tempnet-01.origin-trail.network';

// const otpAccountWithTokens = {
//     accountPublicKey: '5DUvt9Y2tG2jgNWDpiYAMiDnd2LANmfRb7bM7JEEsBvWvuw8',
//     accountPrivateKey: '0x706f08da771dec10b973336012695585a49c6c13a0785d3fdf8a28ca35ddde52'
// }

class AccountsMapping {
    async initialize() {
        // Initialise the provider to connect to the local node
        const provider = new WsProvider(endpoint);

        // eslint-disable-next-line no-await-in-loop
        this.parachainProvider = await new ApiPromise({ provider }).isReady;
        this.web3 = new Web3(endpoint);
        this.initialized = true;
    }

    async mapAccounts() {
        if (!this.initialized) {
            await this.initialize();
        }
        for (const key of keys) {
            try {
                if (!(await this.accountMapped(key.evmOperationalWalletPublicKey))) {
                    // map account
                    const account = await this.mapWallet(
                        key.evmOperationalWalletPublicKey,
                        key.evmOperationalWalletPrivateKey,
                        key.substrateOperationalWalletPrivateKey,
                    );
                    if (account.accountPrivateKey) {
                        key.substrateOperationalWalletPrivateKey = account.accountPrivateKey;
                    }
                    if (account.accountPublicKey) {
                        key.substrateOperationalWalletPublicKey = account.accountPublicKey;
                    }
                }
                if (!(await this.accountMapped(key.evmManagementWalletPublicKey))) {
                    // map account
                    const account = await this.mapWallet(
                        key.evmManagementWalletPublicKey,
                        key.evmManagementWalletPrivateKey,
                        key.substrateManagementWalletPrivateKey,
                    );
                    if (account.accountPrivateKey) {
                        key.substrateManagementWalletPrivateKey = account.accountPrivateKey;
                    }
                    if (account.accountPublicKey) {
                        key.substrateManagementWalletPublicKey = account.accountPublicKey;
                    }
                }
            } catch (error) {
                console.log(`Error while trying to map accounts ${key}. Error: ${error}`);
            }
        }
        fs.writeFileSync('./wallets.json', JSON.stringify(keys, null, 4));
    }

    async mapWallet(evmPublicKey, evmPrivateKey, substratePrivateKey) {
        let account = {};
        if (!substratePrivateKey) {
            account = await this.generateAccount();
            console.log(JSON.stringify(account, null, 4));
        } else {
            account.accountPrivateKey = substratePrivateKey;
        }
        const { signature } = await this.web3.eth.accounts.sign(evmPublicKey, evmPrivateKey);
        const keyring = new Keyring({ type: 'sr25519' });
        const result = await this.callParachainExtrinsic(
            keyring.createFromUri(account.accountPrivateKey),
            'evmAccounts',
            'claimAccount',
            [evmPublicKey, signature],
        );
        if (result.toHex() === '0x') throw Error('Unable to create account mapping for otp');
        return account;
    }

    async generateAccount() {
        const keyring = new Keyring({ type: 'sr25519' });
        const mnemonic = mnemonicGenerate();
        const mnemonicMini = mnemonicToMiniSecret(mnemonic);
        const accountPrivateKey = u8aToHex(mnemonicMini);
        const accountPublicKey = keyring.createFromUri(u8aToHex(mnemonicMini)).address;
        return {
            accountPublicKey,
            accountPrivateKey,
        };
    }

    async fundAccountsWithOtp(account) {
        // keyring
        const keyring = new Keyring({ type: 'sr25519' });

        const uriKeyring = keyring.addFromUri(account.accountPrivateKey);
        return this.callParachainExtrinsic(uriKeyring, 'balances', 'transfer', [100000]);
    }

    async accountMapped(wallet) {
        const result = await this.queryParachainState('evmAccounts', 'accounts', [wallet]);
        return result && result.toHex() !== '0x';
    }

    async callParachainExtrinsic(keyring, extrinsic, method, args) {
        return this.parachainProvider.tx[extrinsic][method](...args).signAndSend(keyring);
    }

    async queryParachainState(state, method, args) {
        return this.parachainProvider.query[state][method](...args);
    }
}
const am = new AccountsMapping();
am.mapAccounts();
