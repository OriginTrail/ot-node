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

        const documentFolderPath = this.fileService.getPendingStorageAssetFolderPath(
            repository,
            blockchain,
            contract,
            tokenId,
        );
        const documentName = this.fileService.getPendingStorageFileName(assertionId);

        await this.fileService.writeContentsToFile(
            documentFolderPath,
            documentName,
            JSON.stringify(assertion),
        );
    }

    async getCachedAssertion(repository, blockchain, contract, tokenId, operationId) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.debug(
            `Reading cached assertion for ual: ${ual}, operation id: ${operationId} from file in ${repository} pending storage`,
        );

        const documentFolderPath = this.fileService.getPendingStorageAssetFolderPath(
            repository,
            blockchain,
            contract,
            tokenId,
        );

        return this.fileService.readFirstFileFromDirectory(documentFolderPath);
    }

    async removeCachedAssertion(repository, blockchain, contract, tokenId, operationId) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.debug(
            `Removing cached assertion for ual: ${ual} operation id: ${operationId} from file in ${repository} pending storage`,
        );

        const documentFolderPath = this.fileService.getPendingStorageAssetFolderPath(
            repository,
            blockchain,
            contract,
            tokenId,
        );
        await this.fileService.removeFolder(documentFolderPath);
    }

    async assetHasPendingState(repository, blockchain, contract, tokenId) {
        const documentFolderPath = this.fileService.getPendingStorageAssetFolderPath(
            repository,
            blockchain,
            contract,
            tokenId,
        );
        this.logger.trace(
            `Checking if asset exists in pending storage at path: ${documentFolderPath}`,
        );
        return this.fileService.directoryExists(documentFolderPath);
    }

    async stateIsPending(repository, blockchain, contract, tokenId, assertionId) {
        const documentPath = this.fileService.getPendingStorageDocumentPath(
            repository,
            blockchain,
            contract,
            tokenId,
            assertionId,
        );
        this.logger.trace(
            `Checking if assertion exists in pending storage at path: ${documentPath}`,
        );
        return this.fileService.fileExists(documentPath);
    }
}

export default PendingStorageService;
