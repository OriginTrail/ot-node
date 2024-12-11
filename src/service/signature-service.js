class SignatureService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;

        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.fileService = ctx.fileService;
    }

    async signMessage(blockchain, message) {
        const messageHash = this.blockchainModuleManager.hashMessage(blockchain, message);
        const { signer, signature: flatSignature } = await this.blockchainModuleManager.signMessage(
            blockchain,
            messageHash,
        );
        const { v, r, s, _vs } = this.blockchainModuleManager.splitSignature(
            blockchain,
            flatSignature,
        );
        return { signer, v, r, s, vs: _vs };
    }

    async addSignatureToStorage(operationId, identityId, signer, v, r, s, vs) {
        await this.fileService.appendContentsToFile(
            this.fileService.getSignatureStorageCachePath(),
            operationId,
            `${JSON.stringify({ identityId, signer, v, r, s, vs })}\n`,
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

export default SignatureService;
