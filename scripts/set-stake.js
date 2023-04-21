/* eslint-disable no-console */
import { ethers } from 'ethers';
import { createRequire } from 'module';
import {
    NODE_ENVIRONMENTS,
    TRANSACTION_POLLING_TIMEOUT_MILLIS,
} from '../src/constants/constants.js';
import validateArguments from './utils.js';

const require = createRequire(import.meta.url);
const Staking = require('dkg-evm-module/abi/Staking.json');
const IdentityStorage = require('dkg-evm-module/abi/IdentityStorage.json');
const ERC20Token = require('dkg-evm-module/abi/Token.json');
const Hub = require('dkg-evm-module/abi/Hub.json');
const argv = require('minimist')(process.argv.slice(1), {
    string: [
        'stake',
        'operationalWalletPrivateKey',
        'managementWalletPrivateKey',
        'hubContractAddress',
    ],
});

const devEnvironment =
    process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
    process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST;

async function setStake(
    rpcEndpoint,
    stake,
    operationalWalletPrivateKey,
    managementWalletPrivateKey,
    hubContractAddress,
) {
    const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
    const operationalWallet = new ethers.Wallet(operationalWalletPrivateKey, provider);
    const managementWallet = new ethers.Wallet(managementWalletPrivateKey, provider);

    const hubContract = new ethers.Contract(hubContractAddress, Hub, provider);

    const stakingContractAddress = await hubContract.getContractAddress('Staking');
    const stakingContract = new ethers.Contract(stakingContractAddress, Staking, managementWallet);

    const identityStorageAddress = await hubContract.getContractAddress('IdentityStorage');
    const identityStorage = new ethers.Contract(identityStorageAddress, IdentityStorage, provider);

    const identityId = await identityStorage.getIdentityId(operationalWallet.address);

    const tokenContractAddress = await hubContract.getContractAddress('Token');
    const tokenContract = new ethers.Contract(tokenContractAddress, ERC20Token, managementWallet);

    const stakeWei = ethers.utils.parseEther(stake);

    let tx = await tokenContract.increaseAllowance(stakingContractAddress, stakeWei, {
        gasPrice: devEnvironment ? undefined : 8,
        gasLimit: 500_000,
    });
    await provider.waitForTransaction(tx.hash, null, TRANSACTION_POLLING_TIMEOUT_MILLIS);
    // TODO: Add ABI instead of hard-coded function definition
    tx = await stakingContract['addStake(uint72,uint96)'](identityId, stakeWei, {
        gasPrice: devEnvironment ? undefined : 1_000,
        gasLimit: 500_000,
    });
    await provider.waitForTransaction(tx.hash, null, TRANSACTION_POLLING_TIMEOUT_MILLIS);
}

const expectedArguments = [
    'rpcEndpoint',
    'stake',
    'operationalWalletPrivateKey',
    'managementWalletPrivateKey',
    'hubContractAddress',
];

if (validateArguments(argv, expectedArguments)) {
    setStake(
        argv.rpcEndpoint,
        argv.stake,
        argv.operationalWalletPrivateKey,
        argv.managementWalletPrivateKey,
        argv.hubContractAddress,
    )
        .then(() => {
            console.log('Set stake completed');
            process.exit(0);
        })
        .catch((error) => {
            console.log('Error while setting stake. Error: ', error);
            process.exit(1);
        });
} else {
    console.log('Wrong arguments sent in script.');
    console.log(
        'Example: npm run set-stake -- --rpcEndpoint=<rpc_enpoint> --stake=<stake> --operationalWalletPrivateKey=<private_key> --managementWalletPrivateKey=<private_key> --hubContractAddress=<hub_contract_address>',
    );
}
