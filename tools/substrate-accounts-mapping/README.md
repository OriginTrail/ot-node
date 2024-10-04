# Substrate accounts mapping tool

This tool:
- generates one shared management wallet (pair of substrate and eth addresses)
- generates NUMBER_OF_ACCOUNTS (default 32) operational wallets
- sends NEURO to all substrate accounts
- performs mapping between substrate and eth pairs
- sends TRAC to all eth wallets
- confirms that TRAC is received

## How to run

Inside the .env file is stored substrate and eth pair for distribution account that will send NEURO and TRAC to newly generated wallets.
Example of env:
```
SUBSTRATE_ACCOUNT_PUBLIC_KEY="gJn..."
SUBSTRATE_ACCOUNT_PRIVATE_KEY="URI FORMAT OF KEY"
EVM_ACCOUNT_PUBLIC_KEY="0xPublicKey"
EVM_ACCOUNT_PRIVATE_KEY="0xPrivateKey"
```

Run the script:
```bash
node accounts-mapping.js
```

Result will be stored in `wallets.json` in this format:
```json
[
    {
        "evmOperationalWalletPublicKey": "",
        "evmOperationalWalletPrivateKey": "",
        "substrateOperationalWalletPublicKey": "",
        "substrateOperationalWalletPrivateKey": "",
        "evmManagementWalletPublicKey": "",
        "evmManagementWalletPrivateKey": "",
        "substrateManagementWalletPublicKey": "",
        "substrateManagementWalletPrivateKey": ""
    }
]
```

## How to modify

To change number of generated accounts, amount of NEURO or TRAC to be sent, or other parameters, following variables should be modified:
```js
const NUMBER_OF_ACCOUNTS = 32;
const NEURO_AMOUNT = 50 * 1e12; // 50 NEURO 
const TRACE_AMOUNT = '0.000000001';

const GAS_PRICE = 20;
const GAS_LIMIT = 60000; // Estimation is 45260
```

Script by default script is created to be used for Neuroweb Mainnet, by modification of following variables it can be used for other parachains:
```js
const TOKEN_ADDRESS = '0xffffffff00000000000000000000000000000001';
const HTTPS_ENDPOINT = 'https://astrosat-parachain-rpc.origin-trail.network';
const NEURO_CHAIN_ID = '2043';
const NEURO_GENESIS_HASH = '0xe7e0962324a3b86c83404dbea483f25fb5dab4c224791c81b756cfc948006174';
```


