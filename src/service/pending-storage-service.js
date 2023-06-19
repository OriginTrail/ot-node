class PendingStorageService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.fileService = ctx.fileService;
        this.ualService = ctx.ualService;
    }

    async cacheAssertion(
        repository,
        blockchain,
        contract,
        tokenId,
        assertionId,
        assertion,
        operationId,
    ) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.debug(
            `Caching ${assertionId} assertion for ual: ${ual}, operation id: ${operationId} in file in ${repository} pending storage`,
        );

        const pendingStorageFolderPath = this.fileService.getPendingStorageFolderPath(
            repository,
            blockchain,
            contract,
            tokenId,
        );

        await this.fileService.writeContentsToFile(
            pendingStorageFolderPath,
            assertionId,
            JSON.stringify(assertion),
        );
    }

    async getCachedAssertion(repository, blockchain, contract, tokenId, operationId) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.debug(
            `Reading cached assertion for ual: ${ual}, operation id: ${operationId} from file in ${repository} pending storage`,
        );
        try {
            const documentPath = await this.fileService.getPendingStorageDocumentPath(
                repository,
                blockchain,
                contract,
                tokenId,
            );

            const data = await this.fileService.readFile(documentPath, true);
            return data;
        } catch (error) {
            this.logger.debug('Assertion not found in pending storage');
            return null;
        }
    }

    async removeCachedAssertion(repository, blockchain, contract, tokenId, operationId) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.debug(
            `Removing cached assertion for ual: ${ual} operation id: ${operationId} from file in ${repository} pending storage`,
        );

        const pendingStorageFolderPath = this.fileService.getPendingStorageFolderPath(
            repository,
            blockchain,
            contract,
        );
        await this.fileService.removeFolder(pendingStorageFolderPath);
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
}

export default PendingStorageService;
