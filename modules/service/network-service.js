const kadence = require('@deadcanaries/kadence');

class NetworkService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
    }

    getPublicKeyData() {
        return {
            public_key: this.config.publicKeyData.publicKey,
            nonce: this.config.publicKeyData.nonce,
            proof: this.config.publicKeyData.proof,
        };
    }

    async validatePublicKeyData(publicKeyData, nodeId) {
        const identity = new kadence.eclipse.EclipseIdentity(
            publicKeyData.publicKey,
            publicKeyData.nonce,
            publicKeyData.proof,
        );

        if (!identity.validate()) {
            this.logger.info('identity proof not yet solved, this can take a while');
            await identity.solve();
        }
        return identity.fingerprint.toString('hex').toLowerCase() === nodeId;
    }
}

module.exports = NetworkService;
