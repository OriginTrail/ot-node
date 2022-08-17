/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
const fs = require('fs');
const { WsProvider, ApiPromise } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');
const { mnemonicGenerate, mnemonicToMiniSecret, decodeAddress } = require('@polkadot/util-crypto');
const { u8aToHex } = require('@polkadot/util');
const Web3 = require('web3');
const { Wallet } = require('@ethersproject/wallet');
const { joinSignature } = require('@ethersproject/bytes');
const { _TypedDataEncoder } = require('@ethersproject/hash');

const walletsPath = './wallets.json';
// eslint-disable-next-line import/no-dynamic-require
const keys = require(walletsPath);

const endpoint = 'wss://lofar.origin-trail.network';
const transferValue = '100000000000000';
const otpAccountWithTokens = {
    accountPublicKey: 'gJmqqH2yWDkhi7qhZZAVYcsBzMAFDazPf2zkhZiTQ5BCD7z4B',
    accountPrivateKey: '0x33914dfa54d7079d40a8edcb4e86769d8254e86bce9d4c6c685b846788d5e7ea',
};

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
                    console.log(`Mapping evm account: ${key.evmOperationalWalletPublicKey}`);
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
                } else {
                    console.log(`Evm account: ${key.evmOperationalWalletPublicKey} already mapped`);
                }
                if (!(await this.accountMapped(key.evmManagementWalletPublicKey))) {
                    console.log(`Mapping evm account: ${key.evmManagementWalletPublicKey}`);
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
                } else {
                    console.log(`Evm account: ${key.evmManagementWalletPublicKey} already mapped`);
                }
            } catch (error) {
                console.log(
                    `Error while trying to map accounts ${JSON.stringify(key)}. Error: ${error}`,
                );
            }
        }
        fs.writeFileSync('./wallets.json', JSON.stringify(keys, null, 4));
    }

    async mapWallet(evmPublicKey, evmPrivateKey, substratePrivateKey) {
        let account = {};
        if (!substratePrivateKey) {
            account = await this.generateAccount();
            await this.fundAccountsWithOtp(account);
            console.log(`Account ${account.accountPublicKey} funded sleeping for 24 seconds`);
            await this.sleepForMilliseconds(24000);
        } else {
            account.accountPrivateKey = substratePrivateKey;
        }
        const signature = await this.sign(account.accountPublicKey, evmPrivateKey);
        const keyring = new Keyring({ type: 'sr25519' });
        keyring.setSS58Format(101);
        const result = await this.callParachainExtrinsic(
            keyring.addFromSeed(account.accountPrivateKey),
            'evmAccounts',
            'claimAccount',
            [evmPublicKey, signature],
        );
        if (result.toHex() === '0x') throw Error('Unable to create account mapping for otp');
        console.log(result.toString());
        console.log(`Account mapped for evm public key: ${evmPublicKey}`);
        return account;
    }

    async generateAccount() {
        const keyring = new Keyring({ type: 'sr25519' });
        keyring.setSS58Format(101);
        const mnemonic = mnemonicGenerate();
        const mnemonicMini = mnemonicToMiniSecret(mnemonic);
        const accountPrivateKey = u8aToHex(mnemonicMini);
        const accountPublicKey = keyring.createFromUri(accountPrivateKey).address;
        return {
            accountPublicKey,
            accountPrivateKey,
        };
    }

    async fundAccountsWithOtp(account) {
        const keyring = new Keyring({ type: 'sr25519' });
        keyring.setSS58Format(101);
        const uriKeyring = keyring.addFromSeed(otpAccountWithTokens.accountPrivateKey);
        return this.callParachainExtrinsic(uriKeyring, 'balances', 'transfer', [
            account.accountPublicKey,
            transferValue,
        ]);
    }

    async accountMapped(wallet) {
        const result = await this.queryParachainState('evmAccounts', 'accounts', [wallet]);
        return result && result.toHex() !== '0x';
    }

    async callParachainExtrinsic(keyring, extrinsic, method, args) {
        console.log(`Calling parachain extrinsic : ${extrinsic}, method: ${method}`);
        return this.parachainProvider.tx[extrinsic][method](...args).signAndSend(keyring, {
            nonce: -1,
        });
    }

    async queryParachainState(state, method, args) {
        return this.parachainProvider.query[state][method](...args);
    }

    async sleepForMilliseconds(milliseconds) {
        await new Promise((r) => setTimeout(r, milliseconds));
    }

    async sign(publicAccountKey, privateEthKey) {
        // const utf8Encode = new TextEncoder();
        // const publicAccountBytes = utf8Encode.encode(publicAccountKey);
        const hexPubKey = u8aToHex(decodeAddress(publicAccountKey));
        console.log(`Hex account pub: ${hexPubKey}`);
        const payload = {
            types: {
                EIP712Domain: [
                    {
                        name: 'name',
                        type: 'string',
                    },
                    {
                        name: 'version',
                        type: 'string',
                    },
                    {
                        name: 'chainId',
                        type: 'uint256',
                    },
                    {
                        name: 'salt',
                        type: 'bytes32',
                    },
                ],
                Transaction: [
                    {
                        name: 'substrateAddress',
                        type: 'bytes',
                    },
                ],
            },
            primaryType: 'Transaction',
            domain: {
                name: 'OTP EVM claim',
                version: '1',
                chainId: '101',
                salt: '0x0542e99b538e30d713d3e020f18fa6717eb2c5452bd358e0dd791628260a36f0',
            },
            message: {
                substrateAddress: hexPubKey,
            },
        };

        const wallet = new Wallet(privateEthKey);

        const digest = _TypedDataEncoder.hash(
            payload.domain,
            {
                Transaction: payload.types.Transaction,
            },
            payload.message,
        );

        const signature = joinSignature(wallet._signingKey().signDigest(digest));
        return signature;
    }
}
const am = new AccountsMapping();
am.mapAccounts();
