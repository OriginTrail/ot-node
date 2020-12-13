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
                // { rpcUrl: 'https://mainnet.infura.io/v3/f8c3858f892d4199840f5354cc954713' },
                // { name: 'mainnet', rpcUrl: 'https://mainnet.infura.io/v3/f8c3858f892d4199840f5354cc954713' },
                // { name: 'testnet', rpcUrl: 'https://rinkeby.infura.io/v3/cd1922142cd94f3ca09289f67899f902' },
                { name: 'development', rpcUrl: this.config.blockchain.rpc_server_url },
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
