import Web3 from 'web3';
import { createRequire } from 'module';
import { callContractFunction, executeContractFunction, validateArguments } from './utils.js';

const require = createRequire(import.meta.url);
const ProfileStorage = require('dkg-evm-module/build/contracts/ProfileStorage.json');
const IdentityStorage = require('dkg-evm-module/build/contracts/IdentityStorage.json');
const Hub = require('dkg-evm-module/build/contracts/Hub.json');
const argv = require('minimist')(process.argv.slice(2), {
    string: ['privateKey', 'hubContractAddress'],
});

async function setAsk(rpcEndpoint, ask, walletPrivateKey, hubContractAddress) {
    const web3 = new Web3(this.config.rpcEndpoints[rpcEndpoint]);
    const walletPublicKey = web3.eth.accounts.privateKeyToAccount(walletPrivateKey).address;
    const hubContract = new web3.eth.Contract(Hub.abi, hubContractAddress);
    const profileStorageAddress = await callContractFunction(hubContract, 'getContractAddress', [
        'ProfileStorage',
    ]);
    console.log('profile storage ', profileStorageAddress);

    const profileStorage = new web3.eth.Contract(ProfileStorage.abi, profileStorageAddress);

    const identityStorageAddress = await callContractFunction(hubContract, 'getContractAddress', [
        'IdentityStorage',
    ]);
    console.log('identity storage ', identityStorageAddress);

    const identityStorage = new web3.eth.Contract(IdentityStorage.abi, identityStorageAddress);

    const identityId = await callContractFunction(identityStorage, 'getIdentityId', [
        walletPublicKey,
    ]);

    await executeContractFunction(
        profileStorage,
        'setAsk',
        [identityId, ask],
        walletPublicKey,
        walletPrivateKey,
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
