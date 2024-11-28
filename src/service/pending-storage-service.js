import path from 'path';
import {
    CONTENT_ASSET_HASH_FUNCTION_ID,
    SERVICE_AGREEMENT_SOURCES,
} from '../constants/constants.js';

class PendingStorageService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.fileService = ctx.fileService;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.tripleStoreService = ctx.tripleStoreService;

        this.memoryCachedHandlersData = {};
    }

    async cacheDataset(operationId, datasetRoot, dataset) {
        this.logger.debug(
            `Caching ${datasetRoot} dataset root, operation id: ${operationId} in file in pending storage, blockchain: ${blockchain}`,
        );

        await this.fileService.writeContentsToFile(
            this.fileService.getPendingStorageCachePath(),
            operationId,
            JSON.stringify({
                merkleRoot: datasetRoot,
                assertion: dataset,
            }),
        );

        this.memoryCachedHandlersData[datasetRoot] = { data: dataset, timestamp: Date.now() };
    }

    async getCachedDataset(blockchain, datasetRoot) {
        this.logger.debug(
            `Retrieving cached dataset for ${datasetRoot} from pending storage, blockchain: ${blockchain}`,
        );

        if (this.memoryCachedHandlersData[datasetRoot]) {
            this.logger.debug(`Dataset found in memory cache for ${datasetRoot}`);
            return this.memoryCachedHandlersData[datasetRoot].data;
        }

        const pendingStorageFolderPath = this.fileService.getPendingStorageFolderPath(
            blockchain,
            datasetRoot,
        );

        const filePath = path.join(pendingStorageFolderPath, datasetRoot);

        try {
            const fileContents = await this.fileService.readFile(filePath, true);
            return fileContents;
        } catch (error) {
            this.logger.error(
                `Failed to retrieve or parse cached dataset for ${datasetRoot}: ${error.message}`,
            );
            throw error;
        }
    }

    async removeExpiredMemoryCache(expirationTimeMillis) {
        this.logger.debug(
            `Cleaning up expired entries from pending storage memory cache older than ${expirationTimeMillis} milliseconds.`,
        );

        const now = Date.now();
        let removedCount = 0;

        for (const [key, value] of Object.entries(this.memoryCachedHandlersData)) {
            if (value.timestamp && now - value.timestamp > expirationTimeMillis) {
                delete this.memoryCachedHandlersData[key];
                removedCount += 1;
            }
        }

        this.logger.debug(
            `Removed ${removedCount} expired entries from pending storage memory cache.`,
        );

        return removedCount;
    }

    async removeExpiredFileCache(expirationTimeMillis, maxRemovalCount) {
        this.logger.debug(
            `Cleaning up expired files older than ${expirationTimeMillis} milliseconds. Max removal: ${maxRemovalCount}`,
        );
    
        const now = Date.now();
        let removedCount = 0;
    
        try {
            const storagePaths = [
                this.fileService.getPendingStorageCachePath(''),
                this.fileService.getSignatureStorageCachePath(''),
            ];
    
            const filesToDelete = [];
    
            const collectFiles = async (basePath) => {
                if (!(await this.fileService.pathExists(basePath))) {
                    this.logger.warn(`Storage path does not exist: ${basePath}`);
                    return;
                }
                
                const blockchainFolders = await this.fileService.readDirectory(basePath);
    
                for (const blockchain of blockchainFolders) {
                    const blockchainPath = path.join(basePath, blockchain);
    
                    // eslint-disable-next-line no-await-in-loop
                    const assertionDirectories = await this.fileService.readDirectory(blockchainPath);
    
                    for (const assertionDir of assertionDirectories) {
                        const assertionPath = path.join(blockchainPath, assertionDir);
    
                        // eslint-disable-next-line no-await-in-loop
                        const files = await this.fileService.readDirectory(assertionPath);
                        files.forEach((file) => filesToDelete.push({ file, assertionPath }));
                    }
                }
            };
    
            for (const basePath of storagePaths) {
                // eslint-disable-next-line no-await-in-loop
                await collectFiles(basePath);
            }
    
            const deleteFile = async ({ file, assertionPath }) => {
                const filePath = path.join(assertionPath, file);
                this.logger.debug(`Attempting to delete file: ${filePath}`);
    
                try {
                    const fileStats = await this.fileService.stat(filePath);
                    this.logger.debug(`File stats for ${filePath}: ${JSON.stringify(fileStats)}`);
    
                    const createdDate = fileStats.mtime;
                    if (createdDate.getTime() + expirationTimeMillis < now) {
                        await this.fileService.removeFile(filePath);
                        this.logger.debug(`Deleted expired file: ${filePath}`);
                        return true;
                    }
                } catch (fileError) {
                    this.logger.warn(`Failed to process file ${filePath}: ${fileError.message}`);
                }
                return false;
            };
    
            for (let i = 0; i < filesToDelete.length; i += maxRemovalCount) {
                const batch = filesToDelete.slice(i, i + maxRemovalCount);
                
                // eslint-disable-next-line no-await-in-loop
                const deletionResults = await Promise.allSettled(batch.map(deleteFile));
    
                removedCount += deletionResults.filter(
                    (result) => result.status === 'fulfilled' && result.value,
                ).length;
    
                if (removedCount >= maxRemovalCount) {
                    this.logger.debug(`Reached max removal count: ${maxRemovalCount}`);
                    return removedCount;
                }
            }
        } catch (error) {
            this.logger.error(`Error during file cleanup: ${error.message}`);
            throw error;
        }
    
        this.logger.debug(`Total files removed: ${removedCount}`);
        return removedCount;
    }
    

    async getCachedAssertion(repository, blockchain, contract, tokenId, assertionId, operationId) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.debug(
            `Reading cached assertion for ual: ${ual}, assertion id: ${assertionId}, operation id: ${operationId} from file in ${repository} pending storage`,
        );
        try {
            const documentPath = await this.fileService.getPendingStorageDocumentPath(operationId);

            const data = await this.fileService.readFile(documentPath, true);
            return data;
        } catch (error) {
            this.logger.debug(
                `Assertion not found in ${repository} pending storage. Error message: ${error.message}, ${error.stackTrace}`,
            );
            return null;
        }
    }

    async removeCachedAssertion(repository, blockchain, contract, tokenId, operationId) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.debug(
            `Removing cached assertion for ual: ${ual} operation id: ${operationId} from file in ${repository} pending storage`,
        );

        const pendingAssertionPath = await this.fileService.getPendingStorageDocumentPath(
            operationId,
        );
        await this.fileService.removeFile(pendingAssertionPath);

        const pendingStorageFolderPath = this.fileService.getParentDirectory(pendingAssertionPath);

        try {
            const otherPendingAssertions = await this.fileService.readDirectory(
                pendingStorageFolderPath,
            );
            if (otherPendingAssertions.length === 0) {
                await this.fileService.removeFolder(pendingStorageFolderPath);
            }
        } catch (error) {
            this.logger.debug(
                `Assertions folder not found in ${repository} pending storage. ` +
                    `Error message: ${error.message}, ${error.stackTrace}`,
            );
        }
    }

    async getPendingState(operationId) {
        return this.fileService.getPendingStorageLatestDocument(operationId);
    }

    async moveAndDeletePendingState(
        currentRepository,
        historyRepository,
        pendingRepository,
        blockchain,
        contract,
        tokenId,
        keyword,
        hashFunctionId,
        assertionId,
        stateIndex,
    ) {
        const agreementId = this.serviceAgreementService.generateId(
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
        );

        let serviceAgreementData = await this.repositoryModuleManager.getServiceAgreementRecord(
            agreementId,
        );
        if (!serviceAgreementData) {
            serviceAgreementData = await this.blockchainModuleManager.getAgreementData(
                blockchain,
                agreementId,
            );
        }

        await this.repositoryModuleManager.updateServiceAgreementRecord(
            blockchain,
            contract,
            tokenId,
            agreementId,
            serviceAgreementData.startTime,
            serviceAgreementData.epochsNumber,
            serviceAgreementData.epochLength,
            serviceAgreementData.scoreFunctionId,
            serviceAgreementData.proofWindowOffsetPerc,
            CONTENT_ASSET_HASH_FUNCTION_ID,
            keyword,
            assertionId,
            stateIndex,
            serviceAgreementData.dataSource ?? SERVICE_AGREEMENT_SOURCES.BLOCKCHAIN,
            serviceAgreementData?.lastCommitEpoch,
            serviceAgreementData?.lastProofEpoch,
        );

        const assertionLinks = await this.tripleStoreService.getAssetAssertionLinks(
            currentRepository,
            blockchain,
            contract,
            tokenId,
        );
        const storedAssertionIds = assertionLinks.map(({ assertion }) =>
            assertion.replace('assertion:', ''),
        );

        // event already handled
        if (storedAssertionIds.includes(assertionId)) {
            return;
        }

        // move old assertions to history repository
        await Promise.all(
            storedAssertionIds.map((storedAssertionId) =>
                this.tripleStoreService.moveAsset(
                    currentRepository,
                    historyRepository,
                    storedAssertionId,
                    blockchain,
                    contract,
                    tokenId,
                    keyword,
                ),
            ),
        );

        await this.tripleStoreService.deleteAssetMetadata(
            currentRepository,
            blockchain,
            contract,
            tokenId,
        );

        const cachedData = await this.getCachedAssertion(
            pendingRepository,
            blockchain,
            contract,
            tokenId,
            assertionId,
        );

        const storePromises = [];
        if (cachedData?.public?.assertion) {
            // insert public assertion in current repository
            storePromises.push(
                this.tripleStoreService.localStoreAsset(
                    currentRepository,
                    assertionId,
                    cachedData.public.assertion,
                    blockchain,
                    contract,
                    tokenId,
                    keyword,
                ),
            );
        }

        if (cachedData?.private?.assertion && cachedData?.private?.assertionId) {
            // insert private assertion in current repository
            storePromises.push(
                this.tripleStoreService.localStoreAsset(
                    currentRepository,
                    cachedData.private.assertionId,
                    cachedData.private.assertion,
                    blockchain,
                    contract,
                    tokenId,
                    keyword,
                ),
            );
        }

        await Promise.all(storePromises);

        // remove asset from pending storage
        if (cachedData) {
            await this.removeCachedAssertion(
                pendingRepository,
                blockchain,
                contract,
                tokenId,
                assertionId,
            );
        }
    }
}

export default PendingStorageService;
