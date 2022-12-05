import Web3 from 'web3';
import { createRequire } from 'module';
import { callContractFunction, executeContractFunction, validateArguments } from './utils.js';

const require = createRequire(import.meta.url);
const Staking = require('dkg-evm-module/build/contracts/Staking.json');
const IdentityStorage = require('dkg-evm-module/build/contracts/IdentityStorage.json');
const Hub = require('dkg-evm-module/build/contracts/Hub.json');
const argv = require('minimist')(process.argv.slice(2));

async function setStake(
    rpcEndpoint,
    stake,
    operationalWalletPrivateKey,
    managementWalletPrivateKey,
    hubContractAddress,
) {
    const web3 = new Web3(this.config.rpcEndpoints[rpcEndpoint]);
    const operationalWalletPublicKey = web3.eth.accounts.privateKeyToAccount(
        operationalWalletPrivateKey,
    ).address;
    const managementWalletPublicKey = web3.eth.accounts.privateKeyToAccount(
        managementWalletPrivateKey,
    ).address;
    const hubContract = new web3.eth.Contract(Hub.abi, hubContractAddress);
    const stakingContractAddress = await callContractFunction(hubContract, 'getContractAddress', [
        'Staking',
    ]);

    const stakingContract = new web3.eth.Contract(Staking.abi, stakingContractAddress);

    const identityStorageAddress = await callContractFunction(hubContract, 'getContractAddress', [
        'IdentityStorage',
    ]);

    const identityStorage = new web3.eth.Contract(IdentityStorage.abi, identityStorageAddress);

    const identityId = await callContractFunction(identityStorage, 'getIdentityId', [
        operationalWalletPublicKey,
    ]);

    await executeContractFunction(
        stakingContract,
        'addStake',
        [identityId, stake],
        managementWalletPublicKey,
        managementWalletPrivateKey,
    );
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
