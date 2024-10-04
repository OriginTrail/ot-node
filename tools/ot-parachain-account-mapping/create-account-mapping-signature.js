/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */
import { Wallet } from '@ethersproject/wallet';
import { joinSignature } from '@ethersproject/bytes';
import { _TypedDataEncoder } from '@ethersproject/hash';
import { u8aToHex } from '@polkadot/util';
import { decodeAddress } from '@polkadot/util-crypto';

if (!process.argv[2]) {
    console.log('Missing argument PRIVATE_ETH_KEY');
    console.log(
        'Usage: npm run create-account-mapping-signature PRIVATE_ETH_KEY SUBSTRATE_PUBLIC_KEY',
    );
    process.exit(1);
}

if (!process.argv[3]) {
    console.log('Missing argument SUBSTRATE_PUBLIC_KEY');
    console.log(
        'Usage: npm run create-account-mapping-signature PRIVATE_ETH_KEY SUBSTRATE_PUBLIC_KEY',
    );
    process.exit(1);
}

const PRIVATE_ETH_KEY = process.argv[2];
const PUBLIC_SUBSTRATE_ADDRESS = process.argv[3];
const HEX_SUBSTRATE_ADDRESS = u8aToHex(decodeAddress(PUBLIC_SUBSTRATE_ADDRESS));
// Usage
// node create-signature.js private_eth_key(with 0x) substrate_public_key

async function sign() {
    const payload = {
        types: {
            EIP712Domain: [
                {
                    name: 'name',
                    type: 'string',
                },
                {
                    name: 'version',
                    type: 'string',
                },
                {
                    name: 'chainId',
                    type: 'uint256',
                },
                {
                    name: 'salt',
                    type: 'bytes32',
                },
            ],
            Transaction: [
                {
                    name: 'substrateAddress',
                    type: 'bytes',
                },
            ],
        },
        primaryType: 'Transaction',
        domain: {
            name: 'NEURO EVM claim',
            version: '1',
            chainId: '2160',
            salt: '0x0542e99b538e30d713d3e020f18fa6717eb2c5452bd358e0dd791628260a36f0',
        },
        message: {
            substrateAddress: `${HEX_SUBSTRATE_ADDRESS}`,
        },
    };

    const wallet = new Wallet(`${PRIVATE_ETH_KEY}`);

    const digest = _TypedDataEncoder.hash(
        payload.domain,
        {
            Transaction: payload.types.Transaction,
        },
        payload.message,
    );

    const signature = joinSignature(wallet._signingKey().signDigest(digest));
    console.log('Paste the signature to polkadot.js api evmAddress claimAccount interface:');
    console.log('==== Signature ====');
    console.log(signature);
    console.log('===================');
}

sign();
