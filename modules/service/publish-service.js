class PublishService {
    constructor(ctx) {
        this.networkService = ctx.networkService;
        this.validationService = ctx.validationService;
        this.blockchainService = ctx.blockchainService;
        this.dataService = ctx.dataService;
        this.logger = ctx.logger;
        this.commandExecutor = ctx.commandExecutor;
        this.fileService = ctx.fileService;
    }

    async publish(fileContent, fileExtension, rawAssets, keywords, visibility, handlerId) {
        let {
            assertion,
            rdf,
        } = await this.dataService.canonize(fileContent, fileExtension);

        assertion.metadata.issuer = this.validationService.getIssuer();
        assertion.metadata.visibility = visibility;
        assertion.metadata.dataHash = this.validationService.calculateHash(assertion.data);
        assertion.metadataHash = this.validationService.calculateHash(assertion.metadata);
        assertion.id = this.validationService.calculateHash(assertion.metadataHash + assertion.metadata.dataHash);
        assertion.signature = this.validationService.sign(assertion.id);

        keywords = [...new Set(keywords.concat(rawAssets))];

        const assets = [];
        for (const asset of rawAssets) {
            assets.push(this.validationService.calculateHash(asset + assertion.metadata.type + assertion.metadata.issuer));
        }

        rdf = await this.dataService.appendMetadata(rdf, assertion);
        assertion.rootHash = this.validationService.calculateRootHash(rdf);
        rdf = await this.dataService.appendConnections(rdf, {
            assertionId: assertion.id,
            assets,
            keywords,
            rootHash: assertion.rootHash,
        });

        if (!assertion.metadata.visibility) {
            rdf = rdf.filter((x) => x.startsWith('<did:dkg:'));
        }

        this.logger.info(`Assertion ID: ${assertion.id}`);
        this.logger.info(`Assertion metadataHash: ${assertion.metadataHash}`);
        this.logger.info(`Assertion dataHash: ${assertion.metadata.dataHash}`);
        this.logger.info(`Assertion rootHash: ${assertion.rootHash}`);
        this.logger.info(`Assertion signature: ${assertion.signature}`);
        this.logger.info(`Assertion metadata: ${JSON.stringify(assertion.metadata)}`);
        // this.logger.info(`Assertion metadata: ${JSON.stringify(assertion.data)}`);
        this.logger.info(`Keywords: ${keywords}`);
        this.logger.info(`Assets: ${assets}`);
        this.logger.info(`Assertion length in N-QUADS format: ${rdf.length}`);

        const handlerIdCachePath = this.fileService.getHandlerIdCachePath();

        const documentPath = await this.fileService
            .writeContentsToFile(handlerIdCachePath, handlerId, JSON.stringify({
                rdf, assertion,
            }));

        const commandSequence = [
            'insertAssertionCommand',
            'submitProofsCommand',
            'sendAssertionCommand',
        ];

        await this.commandExecutor.add({
            name: commandSequence[0],
            sequence: commandSequence.slice(1),
            delay: 0,
            data: {
                documentPath, assets, keywords, handlerId,
            },
            transactional: false,
        });

        return assertion;
    }

    async store(assertion, node) {
        // await this.networkService.store(node, topic, {});
        return await this.networkService.sendMessage('/store', assertion, node);
    }

    async handleStore(rawAssertion) {
        if (!rawAssertion || !rawAssertion.rdf) return false;
        const { assertion, rdf } = await this.dataService.createAssertion(rawAssertion.id, rawAssertion.rdf);
        const status = await this.dataService.verifyAssertion(assertion, rdf);

        // todo check root hash on the blockchain
        if (status) {
            await this.dataService.insert(rawAssertion.rdf.join('\n'), `did:dkg:${assertion.id}`);
            this.logger.info(`Assertion ${assertion.id} is successfully inserted`);
        }
        return status;
    }
}

module.exports = PublishService;
