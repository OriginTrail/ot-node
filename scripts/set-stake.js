import Web3 from 'web3';
import { createRequire } from 'module';
import { callContractFunction, executeContractFunction, validateArguments } from './utils.js';

const require = createRequire(import.meta.url);
const Staking = require('dkg-evm-module/build/contracts/Staking.json');
const IdentityStorage = require('dkg-evm-module/build/contracts/IdentityStorage.json');
const Hub = require('dkg-evm-module/build/contracts/Hub.json');
const argv = require('minimist')(process.argv.slice(2));

async function setStake(rpcEndpoint, stake, walletPrivateKey, hubContractAddress) {
    const web3 = new Web3(this.config.rpcEndpoints[rpcEndpoint]);
    const walletPublicKey = web3.eth.accounts.privateKeyToAccount(walletPrivateKey).address;
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
        walletPublicKey,
    ]);

    await executeContractFunction(
        stakingContract,
        'addStake',
        [identityId, stake],
        walletPublicKey,
        walletPrivateKey,
    );
}

const expectedArguments = ['rpcEndpoint', 'stake', 'privateKey', 'hubContractAddress'];

if (validateArguments(argv, expectedArguments)) {
    setStake(argv.rpcEndpoint, argv.stake, argv.privateKey, argv.hubContractAddress)
        .then(() => {
            console.log('Set stake completed');
        })
        .catch((error) => {
            console.log('Error while setting stake. Error: ', error);
        });
} else {
    console.log('Wrong arguments sent in script.');
    console.log(
        'Example: npm run set-ask -- --rpcEndpoint=<rpc_enpoint> --stake=<ask> --privateKey=<ask> --hubContractAddress=<hub_contract_address>',
    );
}
