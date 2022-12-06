import { ethers } from 'ethers';
import { createRequire } from 'module';
import validateArguments from './utils.js';

const require = createRequire(import.meta.url);
const ProfileStorage = require('dkg-evm-module/build/contracts/ProfileStorage.json');
const IdentityStorage = require('dkg-evm-module/build/contracts/IdentityStorage.json');
const Hub = require('dkg-evm-module/build/contracts/Hub.json');
const argv = require('minimist')(process.argv.slice(1), {
    string: ['ask', 'privateKey', 'hubContractAddress'],
});

async function setAsk(rpcEndpoint, ask, walletPrivateKey, hubContractAddress) {
    const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
    const wallet = new ethers.Wallet(walletPrivateKey);

    const hubContract = new ethers.Contract(hubContractAddress, Hub.abi, provider);

    const profileStorageAddress = await hubContract.getContractAddress('ProfileStorage');
    const profileStorage = new ethers.Contract(profileStorageAddress, ProfileStorage.abi, provider);

    const identityStorageAddress = await hubContract.getContractAddress('IdentityStorage');
    const identityStorage = new ethers.Contract(
        identityStorageAddress,
        IdentityStorage.abi,
        provider,
    );

    const identityId = await identityStorage.getIdentityId(wallet.address);

    const askWei = ethers.utils.parseEther(ask);

    const walletSigner = wallet.connect(provider);
    profileStorage.connect(walletSigner).setAsk(identityId, askWei, { gasLimit: 1_000_000 });
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
