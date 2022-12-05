import Web3 from 'web3';
import { createRequire } from 'module';
import { callContractFunction, executeContractFunction, validateArguments } from './utils.js';

const require = createRequire(import.meta.url);
const Staking = require('dkg-evm-module/build/contracts/Staking.json');
const IdentityStorage = require('dkg-evm-module/build/contracts/IdentityStorage.json');
const Hub = require('dkg-evm-module/build/contracts/Hub.json');
const argv = require('minimist')(process.argv.slice(2));

async function setOperatorFee(rpcEndpoint, operatorFee, walletPrivateKey, hubContractAddress) {
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
        'setOperatorFee',
        [identityId, operatorFee],
        walletPublicKey,
        walletPrivateKey,
    );
}

const expectedArguments = ['rpcEndpoint', 'operatorFee', 'privateKey', 'hubContractAddress'];

if (validateArguments(argv, expectedArguments)) {
    setOperatorFee(argv.rpcEndpoint, argv.operatorFee, argv.privateKey, argv.hubContractAddress);
} else {
    console.log('Wrong arguments sent in script.');
    console.log(
        'Example: npm run set-ask -- --rpcEndpoint=<rpc_enpoint> --operatorFee=<ask> --privateKey=<ask> --hubContractAddress=<hub_contract_address>',
    );
}
