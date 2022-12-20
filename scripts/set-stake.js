import { ethers } from 'ethers';
import { createRequire } from 'module';
import validateArguments from './utils.js';

const require = createRequire(import.meta.url);
const Staking = require('dkg-evm-module/build/contracts/Staking.json');
const IdentityStorage = require('dkg-evm-module/build/contracts/IdentityStorage.json');
const ERC20Token = require('dkg-evm-module/build/contracts/ERC20Token.json');
const Hub = require('dkg-evm-module/build/contracts/Hub.json');
const argv = require('minimist')(process.argv.slice(1), {
    string: [
        'stake',
        'operationalWalletPrivateKey',
        'managementWalletPrivateKey',
        'hubContractAddress',
    ],
});

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

    const hubContract = new ethers.Contract(hubContractAddress, Hub.abi, provider);

    const stakingContractAddress = await hubContract.getContractAddress('Staking');
    const stakingContract = new ethers.Contract(
        stakingContractAddress,
        Staking.abi,
        managementWallet,
    );

    const identityStorageAddress = await hubContract.getContractAddress('IdentityStorage');
    const identityStorage = new ethers.Contract(
        identityStorageAddress,
        IdentityStorage.abi,
        provider,
    );

    const identityId = await identityStorage.getIdentityId(operationalWallet.address);

    const tokenContractAddress = await hubContract.getContractAddress('Token');
    const tokenContract = new ethers.Contract(
        tokenContractAddress,
        ERC20Token.abi,
        managementWallet,
    );

    const stakeWei = ethers.utils.parseEther(stake);

    await tokenContract.increaseAllowance(stakingContractAddress, stakeWei, {
        gasPrice: process.env.NODE_ENV === 'development' ? undefined : 8,
        gasLimit: 500_000,
    });
    // TODO: Add ABI instead of hard-coded function definition
    await stakingContract['addStake(uint72,uint96)'](identityId, stakeWei, {
        gasPrice: process.env.NODE_ENV === 'development' ? undefined : 1_000,
        gasLimit: 500_000,
    });
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
