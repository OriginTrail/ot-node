class PublishService {
    constructor(ctx) {
        this.networkService = ctx.networkService;
        this.validationService = ctx.validationService;
        this.blockchainService = ctx.blockchainService;
        this.dataService = ctx.dataService;
        this.logger = ctx.logger;
    }

    async store(assertion, node) {
        // await this.networkService.store(node, topic, {});
        return await this.networkService.sendMessage('/store', assertion, node);
    }

    async handleStore(rawAssertion) {
        if (!rawAssertion || !rawAssertion.rdf)
            return false;
        const {assertion, rdf } = await this.dataService.createAssertion(rawAssertion.id, rawAssertion.rdf);
        const status = await this.dataService.verifyAssertion(assertion, rdf);

        //todo check root hash on the blockchain
        if (status) {
            await this.dataService.insert(rawAssertion.rdf.join('\n'), `did:dkg:${assertion.id}`);
            this.logger.info(`Assertion ${assertion.id} is successfully inserted`);
        }
        return status;
    }
}

module.exports = PublishService;
