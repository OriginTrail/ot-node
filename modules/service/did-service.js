const { Resolver } = require('did-resolver');
const { getResolver } = require('ethr-did-resolver');
const DataIntegrityResolver = require('./data-integrity/data-integrity-resolver');

class DIDService {
    // constructor(ctx) {
    //     this.logger = ctx.logger;
    // }

    async resolve(didUrl) {
        const providerConfig = {
            networks: [
                { rpcUrl: 'https://mainnet.infura.io/v3/f8c3858f892d4199840f5354cc954713' },
                { name: 'mainnet', rpcUrl: 'https://mainnet.infura.io/v3/f8c3858f892d4199840f5354cc954713' },
                { name: 'testnet', rpcUrl: 'https://rinkeby.infura.io/v3/cd1922142cd94f3ca09289f67899f902' },
                { name: 'development', rpcUrl: 'http://localhost:7545' },
            ],
        };

        const ethrDidResolver = getResolver(providerConfig);
        const didResolver = new Resolver(ethrDidResolver);

        const document = await didResolver.resolve(didUrl);
        return document;
    }
}

// module.exports = DIDService;

async function main() {
    const testnetPrivKey = '0x2d08db59d17c3180f8ac8118b8223ef45f32daa90fa317f8fc727eab6110b181';
    const testnet = 'did:ethr:testnet:0x66B63c36ccb5B86dbe8DdC73D692e6ECd16365c0';
    const mainnet = 'did:ethr:mainnet:0x1471292a8704Eaa151b8B3B6BcffB098ae63Bdad';
    const defaultnet = 'did:ethr:testnet:0x1471292a8704Eaa151b8B3B6BcffB098ae63Bdad';

    const message = 'demo text';


    const service = new DIDService();
    try {
        const dataIntegrityService = DataIntegrityResolver.getInstance().resolve();
        const signature = dataIntegrityService.sign(
            message,
            testnetPrivKey,
        );

        const document = await service.resolve(testnet);
        console.log(document);
        const result = dataIntegrityService.verify(message, signature.signature, document.publicKey[0].ethereumAddress);
        console.log(result);
    } catch (e) {
        console.log(e.message);
    }
}

main();
