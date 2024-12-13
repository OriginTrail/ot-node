class SignatureService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;

        this.cryptoService = ctx.cryptoService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.fileService = ctx.fileService;
    }

    async signMessage(blockchain, messageHash) {
        const flatSignature = await this.blockchainModuleManager.signMessage(
            blockchain,
            messageHash,
        );
        const { v, r, s, _vs } = this.cryptoService.splitSignature(flatSignature);
        return { v, r, s, vs: _vs };
    }

    async addSignatureToStorage(folderName, operationId, identityId, v, r, s, vs) {
        await this.fileService.appendContentsToFile(
            this.fileService.getSignatureStorageFolderPath(folderName),
            operationId,
            `${JSON.stringify({ identityId, v, r, s, vs })}\n`,
        );
    }

    async getSignaturesFromStorage(folderName, operationId) {
        const signatureStorageFile = this.fileService.getSignatureStorageDocumentPath(
            folderName,
            operationId,
        );

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

export default SignatureService;
