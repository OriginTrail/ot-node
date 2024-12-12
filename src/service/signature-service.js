class SignatureService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;

        this.cryptoService = ctx.cryptoService;
        this.fileService = ctx.fileService;
    }

    async signMessage(blockchain, message) {
        const messageHash = this.cryptoService.hashMessage(message);
        const { signer, signature: flatSignature } = await this.cryptoService.signMessage(
            messageHash,
        );
        const { v, r, s, _vs } = this.cryptoService.splitSignature(flatSignature);
        return { signer, v, r, s, vs: _vs };
    }

    async addSignatureToStorage(folderName, operationId, identityId, signer, v, r, s, vs) {
        await this.fileService.appendContentsToFile(
            this.fileService.getSignatureStorageFolderPath(folderName),
            operationId,
            `${JSON.stringify({ identityId, signer, v, r, s, vs })}\n`,
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
