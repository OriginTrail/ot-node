const Models = require('../../models/index');
const constants = require('../constants')

class QueryService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.networkService = ctx.networkService;
        this.validationService = ctx.validationService;
        this.dataService = ctx.dataService;
        this.fileService = ctx.fileService;
        this.workerPool = ctx.workerPool;
    }

    async resolve(id, load, isAssetRequested, node) {
        let result = await this.networkService.sendMessage('/resolve', id, node);
        if (!result || (Array.isArray(result) && result[0] === "ack")) {
            return null;
        }

        const { isAsset } = result;
        const rawNquads = result.nquads ? result.nquads : result;
        let assertion = await this.dataService.createAssertion(rawNquads);
        const status = await this.dataService.verifyAssertion(assertion.jsonld, assertion.nquads, {isAsset: isAssetRequested});

        if (status && load) {
            await this.dataService.insert(rawNquads.join('\n'), `${constants.DID_PREFIX}:${assertion.jsonld.metadata.id}`);
            this.logger.info(`Assertion ${assertion.jsonld.metadata.id} has been successfully inserted`);
        }
        return status ? { assertion, isAsset } : null;
    }

    async handleResolve(id) {
        const {nquads, isAsset} = await this.dataService.resolve(id);
        this.logger.info(`Retrieved data from the database: ${await this.workerPool.exec('JSONStringify', [nquads])}`);

        if (!nquads)
            return null;
        return {nquads, isAsset};
    }

    async search(data, node) {
        const result = await this.networkService.sendMessage('/search', data, node);
        return result;
    }

    async handleSearch(request) {
        const {query, issuers, types, prefix, limit, handlerId} = request;
        let response = await this.dataService.searchByQuery(query, {issuers, types, prefix, limit});

        return {response, handlerId};
    }

    async handleSearchResult(request) {
        // TODO: add mutex
        const {handlerId, response} = request;

        const documentPath = this.fileService.getHandlerIdDocumentPath(handlerId);
        const handlerData = await this.fileService.loadJsonFromFile(documentPath);

        for (const assertion of response) {
            if (!assertion || !assertion.nquads) continue;

            const rawNquads = assertion.nquads ? assertion.nquads : assertion.rdf;
            const { jsonld, nquads } = await this.dataService.createAssertion(rawNquads);
            let object = handlerData.find(x => x.type === jsonld.metadata.type && x.id === jsonld.metadata.UALs[0])
            if (!object) {
                object = {
                    type: jsonld.metadata.type,
                    id: jsonld.metadata.UALs[0],
                    timestamp: jsonld.metadata.timestamp,
                    issuers: [],
                    assertions: [],
                    nodes: [assertion.node]
                }
                handlerData.push(object)
            }

            if (object.nodes.indexOf(assertion.node) === -1) {
                object.nodes.push(assertion.node);
            }

            if (object.issuers.indexOf(jsonld.metadata.issuer) === -1) {
                object.issuers.push(jsonld.metadata.issuer);
            }

            if (object.assertions.indexOf(jsonld.id) === -1) {
                object.assertions.push(jsonld.id);
            }
            if (new Date(object.timestamp) < new Date(jsonld.metadata.timestamp)) {
                object.timestamp = jsonld.metadata.timestamp;
            }
        }


        await this.fileService.writeContentsToFile(
            this.fileService.getHandlerIdCachePath(),
            handlerId,
            await this.workerPool.exec('JSONStringify', [handlerData]),
        );

        await Models.handler_ids.update(
            {
                status: 'PENDING',
            }, {
                where: {
                    handler_id: handlerId,
                },
            },
        );

        return true;
    }

    async searchAssertions(data, node) {
        const result = await this.networkService.sendMessage('/search/assertions', data, node);
        return result;
    }

    async handleSearchAssertions(request) {
        const {query, options, handlerId} = request;
        let response = await this.dataService.searchAssertions(query, options);
        return {response, handlerId};
    }

    async handleSearchAssertionsResult(request) {
        // TODO: add mutex
        const {handlerId, response} = request;

        const documentPath = this.fileService.getHandlerIdDocumentPath(handlerId);
        const handlerData = await this.fileService.loadJsonFromFile(documentPath);

        for (const object of response) {
            const assertion = handlerData.find((x) => x.id === object.assertionId);
            if (assertion) {
                if (assertion.nodes.indexOf(object.node) === -1)
                    assertion.nodes = [...new Set(assertion.nodes.concat(object.node))]
            } else {
                if (!object || !object.nquads)
                    continue
                const rawNquads = object.nquads ? object.nquads : object.rdf;
                const assertion = await this.dataService.createAssertion(rawNquads);

                handlerData.push({
                    id: assertion.jsonld.id,
                    metadata: assertion.jsonld.metadata,
                    signature: assertion.jsonld.signature,
                    nodes: [object.node]
                })
            }
        }


        await this.fileService.writeContentsToFile(
            this.fileService.getHandlerIdCachePath(),
            handlerId,
            JSON.stringify(handlerData),
        );

        await Models.handler_ids.update(
            {
                status: 'PENDING',
            }, {
                where: {
                    handler_id: handlerId,
                },
            },
        );

        return true;
    }
}

module.exports = QueryService;
