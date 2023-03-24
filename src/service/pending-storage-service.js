class PendingStorageService {
    constructor(ctx) {
        this.logger = ctx.logger;

        this.fileService = ctx.fileService;
        this.ualService = ctx.ualService;
    }

    async cacheAssertion(repository, blockchain, contract, tokenId, assertion, operationId) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.debug(
            `Caching assertion for ual: ${ual}, operation id: ${operationId} in file in ${repository} pending storage`,
        );

        const documentPath = this.fileService.getPendingStorageCachePath(repository);
        const documentName = this.fileService.getPendingStorageFileName(
            blockchain,
            contract,
            tokenId,
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

        const documentPath = this.fileService.getPendingStorageDocumentPath(
            repository,
            blockchain,
            contract,
            tokenId,
        );
        let data;
        if (await this.fileService.fileExists(documentPath)) {
            data = await this.fileService.loadJsonFromFile(documentPath);
        }

        return data;
    }

    async removeCachedAssertion(repository, blockchain, contract, tokenId, operationId) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.debug(
            `Removing cached assertion for ual: ${ual} operation id: ${operationId} from file in ${repository} pending storage`,
        );

        const documentPath = this.fileService.getPendingStorageDocumentPath(
            repository,
            blockchain,
            contract,
            tokenId,
        );
        await this.fileService.removeFile(documentPath);
    }

    async assertionExists(repository, blockchain, contract, tokenId) {
        const documentPath = this.fileService.getPendingStorageDocumentPath(
            repository,
            blockchain,
            contract,
            tokenId,
        );
        this.logger.trace(
            `Checking if assertion exists in pending storage on path: ${documentPath}`,
        );
        return this.fileService.fileExists(documentPath);
    }
}

export default PendingStorageService;
