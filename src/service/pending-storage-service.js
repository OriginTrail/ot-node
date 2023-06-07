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
        stateId,
        assertion,
        operationId,
    ) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.debug(
            `Caching assertion for ual: ${ual}, operation id: ${operationId} in file in ${repository} pending storage`,
        );

        const documentPath = this.fileService.getPendingStorageCachePath(repository);
        const documentName = this.fileService.getPendingStorageFileNamePattern(
            blockchain,
            contract,
            tokenId,
            stateId,
        );

        await this.fileService.writeContentsToFile(
            documentPath,
            documentName,
            JSON.stringify(assertion),
        );
    }

    async getCachedAssertion(repository, blockchain, contract, tokenId, operationId) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.debug(
            `Reading cached assertion for ual: ${ual}, operation id: ${operationId} from file in ${repository} pending storage`,
        );

        const documentPathPattern = this.fileService.getPendingStorageDocumentPathPattern(
            repository,
            blockchain,
            contract,
            tokenId,
        );
        let data;
        if (await this.fileService.fileExists(documentPathPattern)) {
            data = await this.fileService.loadJsonFromFile(documentPathPattern);
        }

        return data;
    }

    async removeCachedAssertion(repository, blockchain, contract, tokenId, operationId) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.debug(
            `Removing cached assertion for ual: ${ual} operation id: ${operationId} from file in ${repository} pending storage`,
        );

        const documentPathPattern = this.fileService.getPendingStorageDocumentPathPattern(
            repository,
            blockchain,
            contract,
            tokenId,
        );
        await this.fileService.removeFiles(documentPathPattern);
    }

    async assetHasPendingState(repository, blockchain, contract, tokenId) {
        const documentPathPattern = this.fileService.getPendingStorageDocumentPathPattern(
            repository,
            blockchain,
            contract,
            tokenId,
        );
        this.logger.trace(
            `Checking if state exists in pending storage matching pattern: ${documentPathPattern}`,
        );
        return this.fileService.fileExists(documentPathPattern);
    }

    async stateIsPending(repository, blockchain, contract, tokenId, stateId) {
        const documentPath = this.fileService.getPendingStorageDocumentPath(
            repository,
            blockchain,
            contract,
            tokenId,
            stateId,
        );
        this.logger.trace(
            `Checking if assertion exists in pending storage on path: ${documentPath}`,
        );
        return this.fileService.fileExists(documentPath);
    }
}

export default PendingStorageService;
