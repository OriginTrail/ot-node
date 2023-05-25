/* eslint-disable no-await-in-loop,import/no-extraneous-dependencies,no-continue */
import { createRequire } from 'module';
import { ethers } from 'ethers';
import DKG from 'dkg.js';
import path from 'path';
import { writeFile, readFile } from 'fs/promises';
import appRootPath from 'app-root-path';
import Logger from '../../src/logger/logger.js';

const require = createRequire(import.meta.url);

const from = Number(process.argv[2]);
let to = process.argv[3];
const filePath = path.join(
    appRootPath.path,
    'tools',
    'validate-root-hash',
    `validation-result-${from}-${to}.json`,
);
const maxErrorCount = 10;
let errorCount = 0;

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
        let runScript = true;
        while (runScript) {
            try {
                // get number of tokens for each content asset storage contract
                for (const assetStorageContractAddress in this.assetStorageContracts) {
                    const storageContract = this.assetStorageContracts[assetStorageContractAddress];
                    if (to === 'latest') {
                        to = Number(
                            await this.provider.getStorageAt(
                                assetStorageContractAddress.toLowerCase(),
                                7,
                            ),
                        );
                    }
                    this.logger.info(
                        `Latest token id: ${to} for storage address: ${assetStorageContractAddress}`,
                    );
                    const validationResult = await this.readValidationResult();
                    for (
                        let tokenId = validationResult.latestTokenId;
                        tokenId < Number(to);
                        tokenId += 1
                    ) {
                        const ual = this.deriveUAL('otp', assetStorageContractAddress, tokenId);
                        this.logger.info(`Validating tokenId: ${tokenId}, with UAL: ${ual}`);
                        const assertionIds = await this.callContractFunction(
                            storageContract,
                            'getAssertionIds',
                            [tokenId],
                        );
                        if (!assertionIds?.length) {
                            this.logger.warn(
                                `Unable to find assertion ids for asset with ual: ${ual}`,
                            );
                            validationResult[ual] = {
                                status: 'MISSING_ASSERTION_IDS',
                            };
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
                            validationResult[ual] = {
                                status: 'AGREEMENT_EXPIRED',
                            };
                            continue;
                        }

                        const startTime = Date.now();
                        const getResult = await this.client.asset.get(ual);
                        const duration = Date.now() - startTime;
                        // calculate root hash
                        if (await this.validateGetResult(getResult)) {
                            this.logger.info(`Valid root hash for ual: ${ual}`);
                            validationResult[ual] = {
                                status: 'VALID_ROOT_HASH',
                                duration,
                            };
                        } else {
                            this.logger.error(`Invalid root hash for ual: ${ual}`);
                            validationResult[ual] = {
                                status: 'INVALID_ROOT_HASH',
                                duration,
                                errorMessage: getResult.operation.publicGet.errorMessage,
                                response: getResult.public,
                            };
                        }
                        validationResult.latestTokenId = tokenId + 1;
                        await this.saveValidationResult(validationResult);
                    }
                }
            } catch (error) {
                this.logger.error(`Error while validating: ${error.message}`);
                if (errorCount >= maxErrorCount) {
                    runScript = false;
                }
                errorCount += 1;
            }
        }
    }

    async saveValidationResult(result) {
        await writeFile(filePath, JSON.stringify(result, null, 4));
    }

    async readValidationResult() {
        try {
            const result = await readFile(filePath);
            return JSON.parse(result);
        } catch (error) {
            return {
                latestTokenId: from,
            };
        }
    }

    async printStats() {
        const result = await this.readValidationResult();

        let invalid = 0;
        let invalidRootHash = 0;
        let totalNumber = 0;
        for (const key in result) {
            const asset = result[key];
            if (asset.errorMessage) {
                invalid += 1;
                if (asset.errorMessage === "Calculated root hashes don't match!") {
                    invalidRootHash += 1;
                }
            }
            totalNumber += 1;
        }
        console.log(
            `Number of invalid: ${invalid}, invalid root hash: ${invalidRootHash}, total number: ${totalNumber}`,
        );
        // this.logger.info();
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

        return Date.now() > agreementStartTime * 1000 + epochLength * 1000 * epochsNumber;
    }

    async validateGetResult(result) {
        return !result.operation?.publicGet?.errorType;
    }
}

const hubContractAddress = '0x5fA7916c48Fe6D5F1738d12Ad234b78c90B4cAdA';
const walletPublicKey = '0x0bbE3909531Ace62Eef218b27378cCc5A9Bb1E70';
const walletPrivateKey = '0x0a4b490a7dcba4b42f53a3d86bf2f3f74ea0a2d2651eb8d8fe6e3cb3925bb47c';
const rpcEndpoint = 'https://astrosat-parachain-rpc.origin-trail.network';
const blockchain = 'otp::mainnet';
const otNodeHostname = process.argv[4];
const otNodePort = '8900';

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

// validateRootHash.printStats().then(() => {});
