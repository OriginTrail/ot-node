const constants = require('../constants')

class PublishService {
    constructor(ctx) {
        this.networkService = ctx.networkService;
        this.validationService = ctx.validationService;
        this.blockchainService = ctx.blockchainService;
        this.dataService = ctx.dataService;
        this.logger = ctx.logger;
        this.commandExecutor = ctx.commandExecutor;
        this.fileService = ctx.fileService;
        this.workerPool = ctx.workerPool;
    }

    async publish(fileContent, fileExtension, keywords, visibility, ual, handlerId, isUrgent = false) {
        let {
            assertion,
            nquads,
        } = await this.dataService.canonize(fileContent, fileExtension);

        if (keywords.length > 10) {
            keywords = keywords.slice(0, 10);
            this.logger.warn('Too many keywords provided, limit is 10. Publishing only to the first 10 keywords.');
        }

        assertion.metadata.issuer = this.validationService.getIssuer();
        assertion.metadata.visibility = visibility;
        assertion.metadata.keywords = keywords;
        assertion.metadata.keywords.sort();
        let method = 'publish';
        if (ual === null) {
            method = 'provision';
            ual = this.validationService.calculateHash(assertion.metadata.timestamp + assertion.metadata.type + assertion.metadata.issuer);
            assertion.metadata.UALs = [ual];
        } else if (ual !== undefined) {
            method = 'update';
            assertion.metadata.UALs = [ual];
        }

        assertion.metadata.dataHash = this.validationService.calculateHash(assertion.data);
        assertion.metadataHash = this.validationService.calculateHash(assertion.metadata);
        assertion.id = this.validationService.calculateHash(assertion.metadataHash + assertion.metadata.dataHash);
        assertion.signature = this.validationService.sign(assertion.id);

        nquads = await this.dataService.appendMetadata(nquads, assertion);
        assertion.rootHash = this.validationService.calculateRootHash(nquads);

        if (ual !== undefined) {
            this.logger.info(`UAL: ${ual}`);
        }
        this.logger.info(`Assertion ID: ${assertion.id}`);
        this.logger.info(`Assertion metadataHash: ${assertion.metadataHash}`);
        this.logger.info(`Assertion dataHash: ${assertion.metadata.dataHash}`);
        this.logger.info(`Assertion rootHash: ${assertion.rootHash}`);
        this.logger.info(`Assertion signature: ${assertion.signature}`);
        this.logger.info(`Assertion length in N-QUADS format: ${nquads.length}`);
        this.logger.info(`Keywords: ${keywords}`);

        const handlerIdCachePath = this.fileService.getHandlerIdCachePath();

        const documentPath = await this.fileService
            .writeContentsToFile(handlerIdCachePath, handlerId,
                await this.workerPool.exec('JSONStringify', [{
                    nquads, assertion
                }]));

        const commandSequence = [
            'submitProofsCommand',
            'insertAssertionCommand',
            'sendAssertionCommand',
        ];

        await this.commandExecutor.add({
            name: commandSequence[0],
            sequence: commandSequence.slice(1),
            delay: 0,
            data: {
                documentPath, handlerId, method, isUrgent
            },
            transactional: false,
        });

        return assertion;
    }

    async store(assertion, node) {
        // await this.networkService.store(node, topic, {});
        return await this.networkService.sendMessage('/store', assertion, node);
    }

    async handleStore(data) {
        if (!data || data.rdf) return false;
        const { jsonld, nquads } = await this.dataService.createAssertion(data.nquads);
        const status = await this.dataService.verifyAssertion(jsonld, nquads);

        // todo check root hash on the blockchain
        if (status) {
            await this.dataService.insert(data.nquads.join('\n'), `${constants.DID_PREFIX}:${data.id}`);
            this.logger.info(`Assertion ${data.id} has been successfully inserted`);
        }
        return status;
    }
}

module.exports = PublishService;
