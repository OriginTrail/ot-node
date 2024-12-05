class SignatureStorageService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;

        this.fileService = ctx.fileService;
    }

    async addSignatureToStorage(operationId, identityId, signature) {
        await this.fileService.appendContentsToFile(
            this.fileService.getSignatureStorageCachePath(),
            operationId,
            `${JSON.stringify({ identityId, signature })}\n`,
        );
    }

    async getSignaturesFromStorage(operationId) {
        const signatureStorageFile = this.fileService.getSignatureStorageDocumentPath(operationId);

        const rawSignatures = await this.fileService.readFile(signatureStorageFile);
        const signaturesArray = [];
        for (const line of rawSignatures.split('\n')) {
            const trimmedLine = line.trim();
            if (trimmedLine) {
                signaturesArray.push(JSON.parse(trimmedLine));
            }
        }

        return signaturesArray;
    }
}

export default SignatureStorageService;
