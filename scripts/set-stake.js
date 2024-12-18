/* eslint-disable no-console */
import { ethers } from 'ethers';
import { createRequire } from 'module';
import axios from 'axios';
import {
    NODE_ENVIRONMENTS,
    TRANSACTION_POLLING_TIMEOUT_MILLIS,
    TRANSACTION_CONFIRMATIONS,
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
        'gasPriceOracleLink',
    ],
});

const devEnvironment =
    process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
    process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST;

async function getGasPrice(gasPriceOracleLink, hubContractAddress, provider) {
    try {
        if (!gasPriceOracleLink) {
            if (
                hubContractAddress === '0x6C861Cb69300C34DfeF674F7C00E734e840C29C0' ||
                hubContractAddress === '0x144eDa5cbf8926327cb2cceef168A121F0E4A299' ||
                hubContractAddress === '0xaBfcf2ad1718828E7D3ec20435b0d0b5EAfbDf2c'
            ) {
                return provider.getGasPrice();
            }
            return devEnvironment ? undefined : 8;
        }
        let gasPrice;
        const response = await axios.get(gasPriceOracleLink);
        if (
            gasPriceOracleLink === 'https://api.gnosisscan.io/api?module=proxy&action=eth_gasPrice'
        ) {
            gasPrice = Number(response.data.result, 10);
        } else if (
            gasPriceOracleLink === 'https://blockscout.chiadochain.net/api/v1/gas-price-oracle'
        ) {
            gasPrice = Math.round(response.data.average * 1e9);
        } else {
            gasPrice = Math.round(response.result * 1e9);
        }
        this.logger.debug(`Gas price: ${gasPrice}`);
        return gasPrice;
    } catch (error) {
        return undefined;
    }
}

async function setStake(
    rpcEndpoint,
    stake,
    operationalWalletPrivateKey,
    managementWalletPrivateKey,
    hubContractAddress,
    gasPriceOracleLink,
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

    const gasPrice = await getGasPrice(gasPriceOracleLink, hubContractAddress, provider);

    let tx = await tokenContract.increaseAllowance(stakingContractAddress, stakeWei, {
        gasPrice,
        gasLimit: 500_000,
    });

    await provider.waitForTransaction(
        tx.hash,
        TRANSACTION_CONFIRMATIONS,
        TRANSACTION_POLLING_TIMEOUT_MILLIS,
    );
    // TODO: Add ABI instead of hard-coded function definition
    tx = await stakingContract['stake(uint72,uint96)'](identityId, stakeWei, {
        gasPrice: gasPrice ? gasPrice * 100 : undefined,
        gasLimit: 3_000_000,
    });
    await provider.waitForTransaction(
        tx.hash,
        TRANSACTION_CONFIRMATIONS,
        TRANSACTION_POLLING_TIMEOUT_MILLIS,
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
        argv.gasPriceOracleLink,
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
