/* eslint-disable no-console */
import { ethers } from 'ethers';
import { createRequire } from 'module';
import {
    NODE_ENVIRONMENTS,
    TRANSACTION_POLLING_TIMEOUT_MILLIS,
    TRANSACTION_CONFIRMATIONS,
} from '../src/constants/constants.js';
import validateArguments from './utils.js';

const require = createRequire(import.meta.url);
const Profile = require('dkg-evm-module/abi/Profile.json');
const IdentityStorage = require('dkg-evm-module/abi/IdentityStorage.json');
const Hub = require('dkg-evm-module/abi/Hub.json');
const argv = require('minimist')(process.argv.slice(1), {
    string: ['ask', 'privateKey', 'hubContractAddress'],
});

const devEnvironment =
    process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
    process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST;

async function setAsk(rpcEndpoint, ask, walletPrivateKey, hubContractAddress) {
    const provider = new ethers.JsonRpcProvider(rpcEndpoint);
    const wallet = new ethers.Wallet(walletPrivateKey, provider);

    const hubContract = new ethers.Contract(hubContractAddress, Hub, provider);

    const profileAddress = await hubContract.getContractAddress('Profile');
    const profile = new ethers.Contract(profileAddress, Profile, wallet);

    const identityStorageAddress = await hubContract.getContractAddress('IdentityStorage');
    const identityStorage = new ethers.Contract(identityStorageAddress, IdentityStorage, provider);

    const identityId = await identityStorage.getIdentityId(wallet.address);

    const askWei = ethers.parseEther(ask);

    const tx = await profile.setAsk(identityId, askWei, {
        gasPrice: devEnvironment ? undefined : 8,
        gasLimit: 500_000,
    });
    await provider.waitForTransaction(
        tx.hash,
        TRANSACTION_CONFIRMATIONS,
        TRANSACTION_POLLING_TIMEOUT_MILLIS,
    );
}

const expectedArguments = ['rpcEndpoint', 'ask', 'privateKey', 'hubContractAddress'];

if (validateArguments(argv, expectedArguments)) {
    setAsk(argv.rpcEndpoint, argv.ask, argv.privateKey, argv.hubContractAddress)
        .then(() => {
            console.log('Set ask completed');
            process.exit(0);
        })
        .catch((error) => {
            console.log('Error while setting ask. Error: ', error);
            process.exit(1);
        });
} else {
    console.log('Wrong arguments sent in script.');
    console.log(
        'Example: npm run set-ask -- --rpcEndpoint=<rpc_enpoint> --ask=<ask> --privateKey=<ask> --hubContractAddress=<hub_contract_address>',
    );
}
