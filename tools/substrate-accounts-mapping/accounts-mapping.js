/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
require('dotenv').config({ path: `${__dirname}/../../.env` });
const { setTimeout } = require('timers/promises');
const appRootPath = require('app-root-path');
const path = require('path');
const fs = require('fs');
const { ApiPromise, HttpProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');
const { mnemonicGenerate, mnemonicToMiniSecret, decodeAddress } = require('@polkadot/util-crypto');
const { u8aToHex } = require('@polkadot/util');
const Web3 = require('web3');
const { Wallet } = require('@ethersproject/wallet');
const { joinSignature } = require('@ethersproject/bytes');
const { _TypedDataEncoder } = require('@ethersproject/hash');
const ERC20Token = require('dkg-evm-module/build/contracts/ERC20Token.json');

const tokenAddress = '0xffffffff00000000000000000000000000000001';
const endpoint = 'https://lofar-testnet.origin-trail.network';
const transferValue = 5000 * 1e12;
const otpAccountWithTokens = {
    accountPublicKey: process.env.SUBSTRATE_ACCOUNT_PUBLIC_KEY,
    accountPrivateKey: process.env.SUBSTRATE_ACCOUNT_PRIVATE_KEY,
};
const evmAccountWithTokens = {
    publicKey: process.env.EVM_ACCOUNT_PUBLIC_KEY,
    privateKey: process.env.EVM_ACCOUNT_PRIVATE_KEY,
};

const walletsPath = path.join(appRootPath.path, 'tools/substrate-accounts-mapping/wallets.json');
const numberOfAccounts = 10;

class AccountsMapping {
    async initialize() {
        // Initialise the provider to connect to the local node
        const provider = new HttpProvider(endpoint);

        // eslint-disable-next-line no-await-in-loop
        this.parachainProvider = await new ApiPromise({ provider }).isReady;
        this.web3 = new Web3(endpoint);
        this.initialized = true;
        this.tokenContract = new this.web3.eth.Contract(ERC20Token.abi, tokenAddress);
    }

    async mapAccounts() {
        if (!this.initialized) {
            await this.initialize();
        }

        console.log(`generating, mapping and funding management wallet`);
        const {
            evmPublicKey: evmManagementWalletPublicKey,
            evmPrivateKey: evmManagementWalletPrivateKey,
            substratePublicKey: substrateManagementWalletPublicKey,
            substratePrivateKey: substrateManagementWalletPrivateKey,
        } = await this.generateMapAndFund();

        for (let i = 0; i < numberOfAccounts; i += 1) {
            console.log(`generating, mapping and funding operational wallet number ${i + 1}`);
            const currentWallets =
                i === 0 ? [] : JSON.parse(await fs.promises.readFile(walletsPath));

            const {
                evmPublicKey: evmOperationalWalletPublicKey,
                evmPrivateKey: evmOperationalWalletPrivateKey,
                substratePublicKey: substrateOperationalWalletPublicKey,
                substratePrivateKey: substrateOperationalWalletPrivateKey,
            } = await this.generateMapAndFund();

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
            await fs.promises.writeFile(walletsPath, JSON.stringify(currentWallets, null, 4));
        }
        console.log(`generated, mapped and funded all ${numberOfAccounts} wallets`);
    }

    async generateMapAndFund() {
        const { evmPublicKey, evmPrivateKey } = await this.generateEVMAccount();

        const { substratePublicKey, substratePrivateKey } = await this.mapEVMAccount(
            evmPublicKey,
            evmPrivateKey,
        );
        await this.fundAccountsWithTrac(evmPublicKey);

        return {
            evmPublicKey,
            evmPrivateKey,
            substratePublicKey,
            substratePrivateKey,
        };
    }

    async mapEVMAccount(evmPublicKey, evmPrivateKey) {
        if (!(await this.accountMapped(evmPublicKey))) {
            console.log(`Mapping evm account: ${evmPublicKey}`);
            const { substratePublicKey, substratePrivateKey } = await this.mapWallet(
                evmPublicKey,
                evmPrivateKey,
            );
            return { substratePublicKey, substratePrivateKey };
        }
        console.log(`Evm account: ${evmPublicKey} already mapped`);

        return { substratePublicKey: '', substratePrivateKey: '' };
    }

    async mapWallet(evmPublicKey, evmPrivateKey, substratePrivateKey) {
        let account = {};
        if (!substratePrivateKey) {
            account = await this.generateSubstrateAccount();
            await this.fundAccountsWithOtp(account);
            console.log(`Account ${account.substratePublicKey} funded sleeping for 40 seconds`);
            await this.sleepForMilliseconds(40 * 1000);
        } else {
            account.substratePrivateKey = substratePrivateKey;
        }
        const signature = await this.sign(account.substratePublicKey, evmPrivateKey);
        const keyring = new Keyring({ type: 'sr25519' });
        keyring.setSS58Format(101);
        const result = await this.callParachainExtrinsic(
            keyring.addFromSeed(account.substratePrivateKey),
            'evmAccounts',
            'claimAccount',
            [evmPublicKey, signature],
        );
        if (result.toHex() === '0x') throw Error('Unable to create account mapping for otp');
        console.log(result.toString());
        console.log(`Account mapped for evm public key: ${evmPublicKey}`);
        console.log(`Account ${account.substratePublicKey} claimed sleeping for 40 seconds`);
        await this.sleepForMilliseconds(40 * 1000);
        return account;
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
        const { address, privateKey } = await this.web3.eth.accounts.create();
        return { evmPublicKey: address, evmPrivateKey: privateKey };
    }

    async fundAccountsWithOtp(account) {
        const keyring = new Keyring({ type: 'sr25519' });
        keyring.setSS58Format(101);
        const uriKeyring = keyring.addFromSeed(otpAccountWithTokens.accountPrivateKey);
        return this.callParachainExtrinsic(uriKeyring, 'balances', 'transfer', [
            account.substratePublicKey,
            transferValue,
        ]);
    }

    async fundAccountsWithTrac(evmWallet) {
        const val = this.web3.utils.toWei('10000000', 'ether');
        // console.log(val);
        // const gasLimit = await this.tokenContract.methods.transfer(evmWallet, val).estimateGas({
        //     from: evmAccountWithTokens.publicKey,
        // });

        const encodedABI = this.tokenContract.methods.transfer(evmWallet, val).encodeABI();
        const createTransaction = await this.web3.eth.accounts.signTransaction(
            {
                from: evmAccountWithTokens.publicKey,
                to: tokenAddress,
                data: encodedABI,
                gasPrice: 1000,
                gas: 10000000,
            },
            evmAccountWithTokens.privateKey,
        );

        await this.web3.eth.sendSignedTransaction(createTransaction.rawTransaction);

        const tokenBalance = await this.tokenContract.methods.balanceOf(evmWallet).call();
        console.log(`New balance of ${evmWallet} is ${tokenBalance} TRAC`);
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
        await setTimeout(milliseconds);
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
                chainId: '20430',
                salt: '0xf2b8faefcf9c370872d0b4d2eee31d46b4de4a8688153d23d82a39e2d6bc8bbc',
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
