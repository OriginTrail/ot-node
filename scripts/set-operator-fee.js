import { ethers } from 'ethers';
import { createRequire } from 'module';
import validateArguments from './utils.js';

const require = createRequire(import.meta.url);
const Staking = require('dkg-evm-module/abi/Staking.json');
const IdentityStorage = require('dkg-evm-module/abi/IdentityStorage.json');
const Hub = require('dkg-evm-module/abi/Hub.json');
const argv = require('minimist')(process.argv.slice(1), {
    string: ['operatorFee', 'privateKey', 'hubContractAddress'],
});

async function setOperatorFee(rpcEndpoint, operatorFee, walletPrivateKey, hubContractAddress) {
    const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
    const wallet = new ethers.Wallet(walletPrivateKey, provider);

    const hubContract = new ethers.Contract(hubContractAddress, Hub.abi, provider);

    const stakingContractAddress = await hubContract.getContractAddress('Staking');
    const stakingContract = new ethers.Contract(stakingContractAddress, Staking.abi, wallet);

    const identityStorageAddress = await hubContract.getContractAddress('IdentityStorage');
    const identityStorage = new ethers.Contract(
        identityStorageAddress,
        IdentityStorage.abi,
        provider,
    );

    const identityId = await identityStorage.getIdentityId(wallet.address);

    stakingContract.setOperatorFee(identityId, operatorFee, {
        gasPrice: process.env.NODE_ENV === 'development' ? undefined : 8,
        gasLimit: 500_000,
    });
}

const expectedArguments = ['rpcEndpoint', 'operatorFee', 'privateKey', 'hubContractAddress'];

if (validateArguments(argv, expectedArguments)) {
    setOperatorFee(argv.rpcEndpoint, argv.operatorFee, argv.privateKey, argv.hubContractAddress)
        .then(() => {
            console.log('Set operator fee completed');
        })
        .catch((error) => {
            console.log('Error while setting operator fee. Error: ', error);
        });
} else {
    console.log('Wrong arguments sent in script.');
    console.log(
        'Example: npm run set-operator-fee -- --rpcEndpoint=<rpc_enpoint> --operatorFee=<ask> --privateKey=<ask> --hubContractAddress=<hub_contract_address>',
    );
}
