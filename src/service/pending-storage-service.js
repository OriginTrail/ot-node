class PendingStorageService {
    constructor(ctx) {
        this.logger = ctx.logger;

        this.fileService = ctx.fileService;
        this.ualService = ctx.ualService;
    }

    async cacheAssertion(blockchain, contract, tokenId, assertion, operationId) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.debug(
            `Caching assertion for ual: ${ual}, operation id: ${operationId} in file`,
        );

        const documentPath = this.fileService.getPendingStorageCachePath();
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

    async getCachedAssertion(blockchain, contract, tokenId, operationId) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.debug(
            `Reading cached assertion for ual: ${ual}, operation id: ${operationId} from file`,
        );

        const documentPath = this.fileService.getPendingStorageDocumentPath(
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

    async removeCachedAssertion(blockchain, contract, tokenId, operationId) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.debug(`Removing cached assertion for ual: ${ual} operation id: ${operationId}`);

        const documentPath = this.fileService.getPendingStorageDocumentPath(
            blockchain,
            contract,
            tokenId,
        );
        await this.fileService.removeFile(documentPath);
    }

    async assertionExists(blockchain, contract, tokenId) {
        const documentPath = this.fileService.getPendingStorageDocumentPath(
            blockchain,
            contract,
            tokenId,
        );

        return this.fileService.fileExists(documentPath);
    }
}

export default PendingStorageService;
