class SignatureStorageService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;

        this.fileService = ctx.fileService;
    }

    async addSignatureToStorage(blockchain, operationId, signature) {
        const signatureStorageFolder = await this.fileService.getSignatureStorageFolderPath(
            blockchain,
            operationId,
        );
        await this.fileService.appendContentsToFile(
            signatureStorageFolder,
            operationId,
            `${JSON.stringify(signature)}\n`,
        );
    }

    async getSignaturesFromStorage(blockchain, operationId) {
        const signatureStorageFile = await this.fileService.getSignatureStorageFilePath(
            blockchain,
            operationId,
        );

        const rawSignatures = await this.fileService.readFile(signatureStorageFile);
        const signaturesArray = rawSignatures
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line);

        return JSON.stringify(signaturesArray);
    }
}

export default SignatureStorageService;
