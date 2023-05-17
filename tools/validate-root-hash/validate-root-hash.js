/* eslint-disable no-await-in-loop,import/no-extraneous-dependencies */
import { createRequire } from 'module';
import { ethers } from 'ethers';
import DKG from 'dkg.js';
import Logger from '../../src/logger/logger.js';

const require = createRequire(import.meta.url);

const logger = new Logger();

const ABIs = {
    Hub: require('dkg-evm-module/abi/Hub.json'),
    AbstractAsset: require('dkg-evm-module/abi/AbstractAsset.json'),
    ServiceAgreementStorageProxy: require('dkg-evm-module/abi/ServiceAgreementStorageProxy.json'),
};

class ValidateRootHash {
    async initialize(hubContractAddress, privateKey, rpcEndpoint, blockchain, dkgClient) {
        this.logger = logger;
        this.blockchain = blockchain;
        await this.initializeProvider(rpcEndpoint);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        await this.intializeContracts(hubContractAddress);
        this.client = dkgClient;
    }

    async initializeProvider(rpcEndpoint) {
        this.provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
    }

    async intializeContracts(hubContractAddress) {
        this.HubContract = new ethers.Contract(hubContractAddress, ABIs.Hub, this.wallet);

        const serviceAgreementStorageProxyAddress = await this.callContractFunction(
            this.HubContract,
            'getContractAddress',
            ['ServiceAgreementStorageProxy'],
        );

        this.ServiceAgreementStorageProxy = new ethers.Contract(
            serviceAgreementStorageProxyAddress,
            ABIs.ServiceAgreementStorageProxy,
            this.wallet,
        );

        this.assetStorageContracts = {};
        const assetStoragesArray = await this.callContractFunction(
            this.HubContract,
            'getAllAssetStorages',
            [],
        );

        assetStoragesArray.forEach(([, assetStorageAddress]) => {
            this.assetStorageContracts[assetStorageAddress.toLowerCase()] = new ethers.Contract(
                assetStorageAddress,
                ABIs.AbstractAsset,
                this.wallet,
            );
        });
    }

    async callContractFunction(contractInstance, functionName, args = []) {
        try {
            const result = await contractInstance[functionName](...args);
            return result;
        } catch (error) {
            this.logger.error(error);
            throw error;
        }
    }

    async validate() {
        // get number of tokens for each content asset storage contract
        for (const assetStorageContractAddress in this.assetStorageContracts) {
            const storageContract = this.assetStorageContracts[assetStorageContractAddress];
            const latestTokenId = Number(
                await this.provider.getStorageAt(assetStorageContractAddress.toLowerCase(), 7),
            );
            this.logger.info(
                `Latest token id: ${latestTokenId} for storage address: ${assetStorageContractAddress}`,
            );

            for (let tokenId = 0; tokenId < latestTokenId; tokenId += 1) {
                const ual = this.deriveUAL(this.blockchain, assetStorageContractAddress, tokenId);

                const assertionIds = await this.callContractFunction(
                    storageContract,
                    'getAssertionIds',
                    [tokenId],
                );
                if (!assertionIds?.length) {
                    this.logger.warn(`Unable to find assertion ids for asset with ual: ${ual}`);
                    continue;
                }
                // calculate keyword
                const keyword = this.encodePacked(
                    ['address', 'bytes32'],
                    [assetStorageContractAddress, assertionIds[0]],
                );
                const agreementId = await this.generateId(
                    assetStorageContractAddress,
                    tokenId,
                    keyword,
                );
                // check if still valid
                const agreementData = await this.callContractFunction(
                    this.ServiceAgreementStorageProxy,
                    'getAgreementData',
                    [agreementId],
                );

                if (this.agreementExpired(agreementData)) {
                    this.logger.info(`Agreement expired for ual: ${ual}`);
                    continue;
                }
                // call get for this ual;
                const getResult = await this.client.asset.get(ual);
                // calculate root hash
                if (await this.validateGetResult(getResult)) {
                    this.logger.info(`Valid root hash for ual: ${ual}`);
                } else {
                    this.logger.info(`Invalid root hash for ual: ${ual}`);
                    // get and log the issuer
                }
            }
        }
    }

    deriveUAL(blockchain, contract, tokenId) {
        return `did:dkg:${blockchain.toLowerCase()}/${contract.toLowerCase()}/${tokenId}`;
    }

    encodePacked(types, values) {
        return ethers.utils.solidityPack(types, values);
    }

    async sha256(data) {
        if (!ethers.utils.isBytesLike(data)) {
            const bytesLikeData = ethers.utils.toUtf8Bytes(data);
            return ethers.utils.sha256(bytesLikeData);
        }
        return ethers.utils.sha256(data);
    }

    async generateId(assetTypeContractAddress, tokenId, keyword) {
        const data = this.encodePacked(
            ['address', 'uint256', 'bytes'],
            [assetTypeContractAddress, tokenId, keyword],
        );
        return this.sha256(data);
    }

    agreementExpired(agreementData) {
        const agreementStartTime = agreementData['0'].toNumber();
        const epochLength = agreementData['2'].toNumber();
        const epochsNumber = agreementData['1'];

        return Date.now() > agreementStartTime + epochLength * epochsNumber;
    }

    async validateGetResult(result) {
        return !!result;
    }
}

const hubContractAddress = '0x833048F6e6BEa78E0AAdedeCd2Dc2231dda443FB';
const walletPublicKey = '0x0bbE3909531Ace62Eef218b27378cCc5A9Bb1E70';
const walletPrivateKey = '0x0a4b490a7dcba4b42f53a3d86bf2f3f74ea0a2d2651eb8d8fe6e3cb3925bb47c';
const rpcEndpoint = 'https://lofar-tm-rpc.origin-trail.network';
const blockchain = 'parachain::testnet';
const otNodeHostname = '';
const otNodePort = '';

const DkgClient = new DKG({
    endpoint: otNodeHostname,
    port: otNodePort,
    blockchain: {
        name: blockchain,
        publicKey: walletPublicKey,
        privateKey: walletPrivateKey,
    },
    maxNumberOfRetries: 30,
    frequency: 2,
    contentType: 'all',
});

const validateRootHash = new ValidateRootHash();
validateRootHash
    .initialize(hubContractAddress, walletPrivateKey, rpcEndpoint, blockchain, DkgClient)
    .then(async () => {
        await validateRootHash.validate();
    })
    .catch((error) => {
        logger.error(error);
    });
