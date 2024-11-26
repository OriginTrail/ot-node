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
    }

    async cacheDataset(blockchain, datasetRoot, dataset, operationId) {
        this.logger.debug(
            `Caching ${datasetRoot} dataset root, operation id: ${operationId} in file in pending storage`,
        );

        const pendingStorageFolderPath = this.fileService.getPendingStorageFolderPath(
            blockchain,
            datasetRoot,
        );

        await this.fileService.writeContentsToFile(
            pendingStorageFolderPath,
            datasetRoot,
            JSON.stringify(dataset),
        );
    }

    async getCachedAssertion(repository, blockchain, contract, tokenId, assertionId, operationId) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.debug(
            `Reading cached assertion for ual: ${ual}, assertion id: ${assertionId}, operation id: ${operationId} from file in ${repository} pending storage`,
        );
        try {
            const documentPath = await this.fileService.getPendingStorageDocumentPath(
                repository,
                blockchain,
                contract,
                tokenId,
                assertionId,
            );

            const data = await this.fileService.readFile(documentPath, true);
            return data;
        } catch (error) {
            this.logger.debug(
                `Assertion not found in ${repository} pending storage. Error message: ${error.message}, ${error.stackTrace}`,
            );
            return null;
        }
    }

    async removeCachedAssertion(
        repository,
        blockchain,
        contract,
        tokenId,
        assertionId,
        operationId,
    ) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.debug(
            `Removing cached assertion for ual: ${ual} operation id: ${operationId} from file in ${repository} pending storage`,
        );

        const pendingAssertionPath = await this.fileService.getPendingStorageDocumentPath(
            repository,
            blockchain,
            contract,
            tokenId,
            assertionId,
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

    async assetHasPendingState(repository, blockchain, contract, tokenId, assertionId) {
        try {
            const documentPath = await this.fileService.getPendingStorageDocumentPath(
                repository,
                blockchain,
                contract,
                tokenId,
                assertionId,
            );
            this.logger.trace(
                `Checking if assertion exists in pending storage at path: ${documentPath}`,
            );
            return this.fileService.pathExists(documentPath);
        } catch (error) {
            return false;
        }
    }

    async getPendingState(repository, blockchain, contract, tokenId) {
        return this.fileService.getPendingStorageLatestDocument(
            repository,
            blockchain,
            contract,
            tokenId,
        );
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
