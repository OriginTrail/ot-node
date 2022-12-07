import { ethers } from 'ethers';
import { createRequire } from 'module';
import validateArguments from './utils.js';

const require = createRequire(import.meta.url);
const Staking = require('dkg-evm-module/build/contracts/Staking.json');
const IdentityStorage = require('dkg-evm-module/build/contracts/IdentityStorage.json');
const Hub = require('dkg-evm-module/build/contracts/Hub.json');
const argv = require('minimist')(process.argv.slice(1), {
    string: ['operatorFee', 'privateKey', 'hubContractAddress'],
});

async function setOperatorFee(rpcEndpoint, operatorFee, walletPrivateKey, hubContractAddress) {
    const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
    const wallet = new ethers.Wallet(walletPrivateKey);

    const hubContract = new ethers.Contract(hubContractAddress, Hub.abi, provider);

    const stakingContractAddress = await hubContract.getContractAddress('Staking');
    const stakingContract = new ethers.Contract(stakingContractAddress, Staking.abi, provider);

    const identityStorageAddress = await hubContract.getContractAddress('IdentityStorage');
    const identityStorage = new ethers.Contract(
        identityStorageAddress,
        IdentityStorage.abi,
        provider,
    );

    const identityId = await identityStorage.getIdentityId(wallet.address);

    const walletSigner = wallet.connect(provider);
    stakingContract
        .connect(walletSigner)
        .setOperatorFee(identityId, operatorFee, { gasPrice: 1_000, gasLimit: 1_000_000 });
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
