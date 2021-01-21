const { Resolver } = require('did-resolver');
const { getResolver } = require('ethr-did-resolver');
const DataIntegrityResolver = require('./data-integrity/data-integrity-resolver');

class DIDService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
    }

    async resolve(didUrl) {
        const providerConfig = {
            networks: [
                { name: 'mainnet', rpcUrl: this.config.blockchain.rpc_server_url },
            ],
        };

        const ethrDidResolver = getResolver(providerConfig);
        const didResolver = new Resolver(ethrDidResolver);

        const document = await didResolver.resolve(didUrl);
        return document;
    }

    async authenticate(message, signature, didUrl) {
        const document = await this.resolve(didUrl);
        const dataIntegrityService = DataIntegrityResolver.getInstance().resolve();

        return dataIntegrityService.verify(
            message,
            signature,
            document.id.split(':')[document.id.split(':').length - 1],
        );
    }
}

module.exports = DIDService;
