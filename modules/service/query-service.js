const { v1: uuidv1 } = require('uuid');
const constants = require('../constants');

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
        const operationId = uuidv1();
        this.logger.emit({
            msg: 'Started measuring execution of handle resolve command',
            Event_name: 'handle_resolve_start',
            Operation_name: 'handle_resolve',
            Id_operation: operationId,
        });

        const { nquads, isAsset } = await this.dataService.resolve(id);
        this.logger.info(`Retrieved data from the database: ${await this.workerPool.exec('JSONStringify', [nquads])}`);

        this.logger.emit({
            msg: 'Finished measuring execution of handle resolve command',
            Event_name: 'handle_resolve_end',
            Operation_name: 'handle_resolve',
            Id_operation: operationId,
        });

        if (!nquads) {
            return null;
        }
        return { nquads, isAsset };
    }

    async search(data, node) {
        const result = await this.networkService.sendMessage('/search', data, node);
        return result;
    }

    async handleSearch(request) {
        const operationId = uuidv1();
        this.logger.emit({
            msg: 'Started measuring execution of handle search command',
            Event_name: 'handle_search_start',
            Operation_name: 'handle_search',
            Id_operation: operationId,
        });

        const { query, issuers, types, prefix, limit, handlerId } = request;
        const response = await this.dataService.searchByQuery(query, { issuers, types, prefix, limit });

        this.logger.emit({
            msg: 'Finished measuring execution of handle search command',
            Event_name: 'handle_search_end',
            Operation_name: 'handle_search',
            Id_operation: operationId,
        });

        return { response, handlerId };
    }

    async handleSearchResult(request) {
        // TODO: add mutex
        const operationId = uuidv1();
        this.logger.emit({
            msg: 'Started measuring execution of handle search result command',
            Event_name: 'handle_search_result_start',
            Operation_name: 'handle_search_result',
            Id_operation: operationId,
        });

        const { handlerId, response } = request;

        const documentPath = this.fileService.getHandlerIdDocumentPath(handlerId);
        const handlerData = await this.fileService.loadJsonFromFile(documentPath);

        for (const assertion of response) {
            if (!assertion || !assertion.nquads) {
                continue;
            }

            const rawNquads = assertion.nquads ? assertion.nquads : assertion.rdf;
            const { jsonld, nquads } = await this.dataService.createAssertion(rawNquads);
            let object = handlerData.find((x) => x.type === jsonld.metadata.type && x.id === jsonld.metadata.UALs[0])
            if (!object) {
                object = {
                    type: jsonld.metadata.type,
                    id: jsonld.metadata.UALs[0],
                    timestamp: jsonld.metadata.timestamp,
                    issuers: [],
                    assertions: [],
                    nodes: [assertion.node],
                };
                handlerData.push(object);
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

        this.logger.emit({
            msg: 'Finished measuring execution of handle search result command',
            Event_name: 'handle_search_result_end',
            Operation_name: 'handle_search_result',
            Id_operation: operationId,
        });

        return true;
    }

    async searchAssertions(data, node) {
        const result = await this.networkService.sendMessage('/search/assertions', data, node);
        return result;
    }

    async handleSearchAssertions(request) {
        const operationId = uuidv1();
        this.logger.emit({
            msg: 'Started measuring execution of handle search assertions command',
            Event_name: 'handle_search_assertions_start',
            Operation_name: 'handle_search_assertions',
            Id_operation: operationId,
        });

        const { query, options, handlerId } = request;
        const response = await this.dataService.searchAssertions(query, options || {});

        this.logger.emit({
            msg: 'Finished measuring execution of handle search assertions command',
            Event_name: 'handle_search_assertions_end',
            Operation_name: 'handle_search_assertions',
            Id_operation: operationId,
        });
        return { response, handlerId };
    }

    async handleSearchAssertionsResult(request) {
        // TODO: add mutex
        const operationId = uuidv1();
        this.logger.emit({
            msg: 'Started measuring execution of handle search assertions result command',
            Event_name: 'handle_search_assertions_result_start',
            Operation_name: 'handle_search_assertions_result',
            Id_operation: operationId,
        });
        const { handlerId, response } = request;

        const documentPath = this.fileService.getHandlerIdDocumentPath(handlerId);
        const handlerData = await this.fileService.loadJsonFromFile(documentPath);
        if (response !== undefined && response.length && handlerData) {
            for (const object of response) {
                const assertion = handlerData.find((x) => x.id === object.assertionId);
                if (assertion) {
                    if (assertion.nodes.indexOf(object.node) === -1) {
                        assertion.nodes = [...new Set(assertion.nodes.concat(object.node))];
                    }
                } else {
                    if (!object || !object.nquads) {
                        continue
                    }
                    const rawNquads = object.nquads ? object.nquads : object.rdf;
                    const assertion = await this.dataService.createAssertion(rawNquads);

                    handlerData.push({
                        id: assertion.jsonld.id,
                        metadata: assertion.jsonld.metadata,
                        signature: assertion.jsonld.signature,
                        nodes: [object.node],
                    });
                }
            }

            await this.fileService.writeContentsToFile(
                this.fileService.getHandlerIdCachePath(),
                handlerId,
                JSON.stringify(handlerData),
            );
        }

        this.logger.emit({
            msg: 'Finished measuring execution of handle search assertions result command',
            Event_name: 'handle_search_assertions_result_end',
            Operation_name: 'handle_search_assertions_result',
            Id_operation: operationId,
        });
        return true;
    }
}

module.exports = QueryService;
