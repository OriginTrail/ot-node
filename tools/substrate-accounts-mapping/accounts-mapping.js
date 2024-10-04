/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
/* eslint-disable object-shorthand */
/* eslint-disable lines-between-class-members */
require('dotenv').config({ path: `${__dirname}/../../.env` });
const { setTimeout } = require('timers/promises');
const appRootPath = require('app-root-path');
const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');
const { ApiPromise, HttpProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');
const { mnemonicGenerate, mnemonicToMiniSecret, decodeAddress } = require('@polkadot/util-crypto');
const { u8aToHex } = require('@polkadot/util');
const { Wallet } = require('@ethersproject/wallet');
const { joinSignature } = require('@ethersproject/bytes');
const { _TypedDataEncoder } = require('@ethersproject/hash');
const ERC20Token = require('dkg-evm-module/abi/Token.json');

const WALLETS_PATH = path.join(appRootPath.path, 'tools/substrate-accounts-mapping/wallets.json');

const neuroAccountWithTokens = {
    accountPublicKey: process.env.SUBSTRATE_ACCOUNT_PUBLIC_KEY,
    accountPrivateKey: process.env.SUBSTRATE_ACCOUNT_PRIVATE_KEY,
};
const evmAccountWithTokens = {
    publicKey: process.env.EVM_ACCOUNT_PUBLIC_KEY,
    privateKey: process.env.EVM_ACCOUNT_PRIVATE_KEY,
};

const TOKEN_ADDRESS = '0xffffffff00000000000000000000000000000001';
const HTTPS_ENDPOINT = 'https://astrosat-parachain-rpc.origin-trail.network';

const NUMBER_OF_ACCOUNTS = 32;

const NEURO_AMOUNT = 50 * 1e12; // 50 NEURO <--- Check this!
const NEURO_CHAIN_ID = '2043';
const NEURO_GENESIS_HASH = '0xe7e0962324a3b86c83404dbea483f25fb5dab4c224791c81b756cfc948006174';

const GAS_PRICE = 20;
const GAS_LIMIT = 60000; // Estimation is 45260
const TRACE_AMOUNT = '0.000000001'; // <--- Check this!

class AccountsMapping {
    async initialize() {
        // Initialise the provider to connect to the local node
        const provider = new HttpProvider(HTTPS_ENDPOINT);

        // eslint-disable-next-line no-await-in-loop
        this.parachainProvider = await new ApiPromise({ provider }).isReady;
        this.ethersProvider = new ethers.providers.JsonRpcProvider(HTTPS_ENDPOINT);
        this.evmWallet = new ethers.Wallet(evmAccountWithTokens.privateKey, this.ethersProvider);
        this.initialized = true;
        this.tokenContract = new ethers.Contract(TOKEN_ADDRESS, ERC20Token.abi, this.evmWallet);
    }

    async mapAccounts() {
        if (!this.initialized) {
            await this.initialize();
        }

        const currentWallets = [];

        console.log(`Generating, mapping and funding management wallet`);
        const {
            evmPublicKey: evmManagementWalletPublicKey,
            evmPrivateKey: evmManagementWalletPrivateKey,
            substratePublicKey: substrateManagementWalletPublicKey,
            substratePrivateKey: substrateManagementWalletPrivateKey,
        } = await this.generateWallets();

        // Fund management wallet
        await this.fundAccountsWithNeuro(substrateManagementWalletPublicKey);

        // Generate and fund all other wallets
        for (let i = 0; i < NUMBER_OF_ACCOUNTS; i += 1) {
            console.log(`Generating and funding with NEURO wallet #${i + 1}`);

            const {
                evmPublicKey: evmOperationalWalletPublicKey,
                evmPrivateKey: evmOperationalWalletPrivateKey,
                substratePublicKey: substrateOperationalWalletPublicKey,
                substratePrivateKey: substrateOperationalWalletPrivateKey,
            } = await this.generateWallets();

            await this.fundAccountsWithNeuro(substrateOperationalWalletPublicKey);

            // Store new wallets
            currentWallets.push({
                evmOperationalWalletPublicKey,
                evmOperationalWalletPrivateKey,
                substrateOperationalWalletPublicKey,
                substrateOperationalWalletPrivateKey,
                evmManagementWalletPublicKey,
                evmManagementWalletPrivateKey,
                substrateManagementWalletPublicKey,
                substrateManagementWalletPrivateKey,
            });
            await fs.promises.writeFile(WALLETS_PATH, JSON.stringify(currentWallets, null, 4));
        }
        console.log('Waiting 35s for funding TXs to get into block!');
        await this.sleepForMilliseconds(35 * 1000);
        console.log(`${NUMBER_OF_ACCOUNTS} wallets are generated and funded with NEURO!`);

        console.log(`Executing mapping!`);
        // Map the management wallet
        await this.mapWallet(
            evmManagementWalletPublicKey,
            evmManagementWalletPrivateKey,
            substrateManagementWalletPublicKey,
            substrateManagementWalletPrivateKey,
        );
        // Map all operational wallets
        for (const wallet of currentWallets) {
            await this.mapWallet(
                wallet.evmOperationalWalletPublicKey,
                wallet.evmOperationalWalletPrivateKey,
                wallet.substrateOperationalWalletPublicKey,
                wallet.substrateOperationalWalletPrivateKey,
            );
        }
        console.log('Waiting 35s for mapping TXs to get into block!');
        await this.sleepForMilliseconds(35 * 1000);
        console.log(`${NUMBER_OF_ACCOUNTS} wallets mapped!`);

        console.log(`Funding wallets with TRAC!`);
        let nonce = await this.evmWallet.getTransactionCount();
        // Fund management wallet with TRACE
        this.fundAccountsWithTrac(evmManagementWalletPublicKey, nonce);
        // Fund rest of wallets
        for (const wallet of currentWallets) {
            if (await this.accountMapped(wallet.evmOperationalWalletPublicKey)) {
                nonce += 1;
                this.fundAccountsWithTrac(wallet.evmOperationalWalletPublicKey, nonce);
            } else {
                console.log(`Mapping failed or not finished for account: ${wallet}`);
            }
        }
        console.log('Waiting for Trac TXs to get into block!');
        await this.sleepForMilliseconds(35 * 1000);
        console.log(`${NUMBER_OF_ACCOUNTS} wallets funded with TRAC!`);

        // Check the balance of new accounts
        for (const wallet of currentWallets) {
            const tokenBalance = await this.tokenContract.methods
                .balanceOf(wallet.evmOperationalWalletPublicKey)
                .call();
            console.log(
                `New balance of ${wallet.evmOperationalWalletPublicKey} is ${tokenBalance} TRAC`,
            );
        }
    }

    async generateWallets() {
        const { evmPublicKey, evmPrivateKey } = await this.generateEVMAccount();
        const { substratePublicKey, substratePrivateKey } = await this.generateSubstrateAccount();
        return {
            evmPublicKey,
            evmPrivateKey,
            substratePublicKey,
            substratePrivateKey,
        };
    }
    async generateSubstrateAccount() {
        const keyring = new Keyring({ type: 'sr25519' });
        keyring.setSS58Format(101);

        const mnemonic = mnemonicGenerate();
        const mnemonicMini = mnemonicToMiniSecret(mnemonic);
        const substratePrivateKey = u8aToHex(mnemonicMini);
        const substratePublicKey = keyring.createFromUri(substratePrivateKey).address;
        return {
            substratePublicKey,
            substratePrivateKey,
        };
    }

    async generateEVMAccount() {
        const { address, privateKey } = await ethers.Wallet.createRandom();
        return { evmPublicKey: address, evmPrivateKey: privateKey };
    }

    async mapWallet(evmPublicKey, evmPrivateKey, substratePublicKey, substratePrivateKey) {
        const signature = await this.sign(substratePublicKey, evmPrivateKey);
        const keyring = new Keyring({ type: 'sr25519' });
        keyring.setSS58Format(101);
        const result = await this.callParachainExtrinsic(
            keyring.addFromSeed(substratePrivateKey),
            'evmAccounts',
            'claimAccount',
            [evmPublicKey, signature],
        );
        if (result.toHex() === '0x') throw Error('Unable to create account mapping for neuro');
        console.log(result.toString());
        console.log(`Account mapped for evm public key: ${evmPublicKey}`);
    }

    async fundAccountsWithNeuro(substratePublicKey) {
        const keyring = new Keyring({ type: 'sr25519' });
        keyring.setSS58Format(101);
        const uriKeyring = keyring.addFromSeed(neuroAccountWithTokens.accountPrivateKey);
        return this.callParachainExtrinsic(uriKeyring, 'balances', 'transfer', [
            substratePublicKey,
            NEURO_AMOUNT,
        ]);
    }

    async fundAccountsWithTrac(evmWallet, nonce) {
        this.tokenContract.transfer(evmWallet, ethers.utils.parseEther(TRACE_AMOUNT), {
            gasPrice: GAS_PRICE,
            gasLimit: GAS_LIMIT,
            nonce: nonce,
        });
    }

    async accountMapped(wallet) {
        const result = await this.queryParachainState('evmAccounts', 'accounts', [wallet]);
        return result && result.toHex() !== '0x';
    }

    async callParachainExtrinsic(keyring, extrinsic, method, args) {
        // console.log(`Calling parachain extrinsic : ${extrinsic}, method: ${method}`);
        return this.parachainProvider.tx[extrinsic][method](...args).signAndSend(keyring, {
            nonce: -1,
        });
    }

    async queryParachainState(state, method, args) {
        return this.parachainProvider.query[state][method](...args);
    }

    async sleepForMilliseconds(milliseconds) {
        await setTimeout(milliseconds);
    }

    async sign(publicAccountKey, privateEthKey) {
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
                name: 'NEURO EVM claim',
                version: '1',
                chainId: NEURO_CHAIN_ID,
                salt: NEURO_GENESIS_HASH,
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
