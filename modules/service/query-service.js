const Models = require('../../models/index');

class QueryService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.networkService = ctx.networkService;
        this.validationService = ctx.validationService;
        this.dataService = ctx.dataService;
        this.fileService = ctx.fileService;
    }

    async resolve(data, node) {
        let rawRdf = await this.networkService.sendMessage('/resolve', data, node);

        if (!rawRdf) {
            return {assertion: null, rdf: null};
        }

        const assertionId = data;
        const {assertion, rdf} = await this.dataService.createAssertion(assertionId, rawRdf);
        const status = await this.dataService.verifyAssertion(assertion, rdf);
        return status ? {assertion, rdf} : {assertion: null, rdf: null};
    }

    async handleResolve(data) {
        const rdf = await this.dataService.resolve(data);
        this.logger.info(`Retrieved data from the database: ${JSON.stringify(rdf)}`);

        if (!rdf)
            return null;
        return rdf;
    }

    async search(data, node) {
        const result = await this.networkService.sendMessage('/search', data, node);
        return result;
    }

    async handleSearch(request) {
        const {query, ids, issuers, types, prefix, limit, handlerId} = request;
        let response;
        if (query) {
            response = await this.dataService.searchByQuery(query, {issuers, types, prefix, limit});
        } else {
            response = await this.dataService.searchByIds(ids, {issuers, types, limit});
        }
        console.log(JSON.stringify(response, null, 2));
        return { response, handlerId };
    }

    async handleSearchResult(request) {
        // TODO: add mutex
        const { handlerId, response } = request;

        const documentPath = this.fileService.getHandlerIdDocumentPath(handlerId);
        const handlerData = await this.fileService.loadJsonFromFile(documentPath);
        console.log(response);
        for (const asset of response) {
            for (const rawAssertion of asset.assertions) {
                if (!rawAssertion || !rawAssertion.rdf) {
                    continue;
                }
                const {assertion, rdf} = await this.dataService.createAssertion(rawAssertion.id, rawAssertion.rdf);
                console.log(assertion);
                console.log(rdf);
                const status = await this.dataService.verifyAssertion(assertion, rdf);
                //todo check root hash on the blockchain
                if (status) {
                    let object = handlerData.find(x => x.type === assertion.metadata.type && x.id === asset.assetId)
                    if (!object) {
                        object = {
                            type: assertion.metadata.type,
                            id: asset.assetId,
                            timestamp: assertion.metadata.timestamp,
                            data: [],
                            issuers: [],
                            assertions: [],
                            nodes: [rawAssertion.node]
                        }
                        handlerData.push(object)
                    }


                    if (object.nodes.indexOf(rawAssertion.node) === -1) {
                        object.nodes.push(rawAssertion.node);
                    }

                    if (object.issuers.indexOf(assertion.metadata.issuer) === -1) {
                        object.issuers.push(assertion.metadata.issuer);
                    }

                    if (object.assertions.indexOf(assertion.id) === -1) {
                        object.assertions.push(assertion.id);
                        object.data.push({
                            id: assertion.id,
                            timestamp: assertion.metadata.timestamp,
                            data: assertion.data
                        });
                    }
                    if (new Date(object.timestamp) < new Date(assertion.metadata.timestamp)) {
                        object.timestamp = assertion.metadata.timestamp;
                    }
                }
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

    async searchAssertions(data, node) {
        const result = await this.networkService.sendMessage('/search/assertions', data, node);
        return result;
    }

    async handleSearchAssertions(request) {
        const {query, handlerId, load } = request;
        let response = await this.dataService.searchAssertions(query, { });
        return { response, handlerId, load };
    }

    async handleSearchAssertionsResult(request) {
        // TODO: add mutex
        const { handlerId, response, load } = request;

        const documentPath = this.fileService.getHandlerIdDocumentPath(handlerId);
        const handlerData = await this.fileService.loadJsonFromFile(documentPath);

        for (const object of response) {
            const assertion = handlerData.find((x) => x.id === object.assertionId);
            if (assertion) {
                if (assertion.nodes.indexOf(object.node) === -1)
                    assertion.nodes = [...new Set(assertion.nodes.concat(object.node))]
            } else {
                if (!object || !object.rdf)
                    continue

                const {assertion, rdf} = await this.dataService.createAssertion(object.assertionId, object.rdf);
                const status = await this.dataService.verifyAssertion(assertion, rdf);
                //todo check root hash on the blockchain
                if (status) {
                    handlerData.push({
                        id: assertion.id,
                        metadata: assertion.metadata,
                        signature: assertion.signature,
                        rootHash: assertion.rootHash,
                        nodes: [object.node]
                    })

                    if (load) {
                        await this.dataService.insert(object.rdf, `did:dkg:${object.assertionId}`);
                        this.logger.info(`Assertion ${object.assertionId} is successfully inserted`);
                    }
                }
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
