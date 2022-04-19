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

    async resolve(id, load, isAssetRequested, node, operationId) {
        const resolvePromise = new Promise(async (resolve, reject) => {
            const timer = setTimeout(() => {
                resolve(null);
            }, constants.RESOLVE_MAX_TIME_MILLIS);

            const result = await this.networkService.sendMessage(
                constants.NETWORK_PROTOCOLS.RESOLVE,
                id,
                node,
            );
            clearTimeout(timer);
            resolve(result);
        });

        this.logger.emit({
            msg: 'Started measuring execution of resolve fetch from nodes',
            Event_name: 'resolve_fetch_from_nodes_start',
            Operation_name: 'resolve_fetch_from_nodes',
            Id_operation: operationId,
        });

        const result = await resolvePromise;

        this.logger.emit({
            msg: 'Finished measuring execution of resolve fetch from nodes',
            Event_name: 'resolve_fetch_from_nodes_end',
            Operation_name: 'resolve_fetch_from_nodes',
            Id_operation: operationId,
        });
        if (!result
            || (Array.isArray(result) && result[0] === constants.NETWORK_RESPONSES.ACK)
            || result === constants.NETWORK_RESPONSES.BUSY) {
            return null;
        }

        const rawNquads = result.nquads ? result.nquads : result;
        this.logger.emit({
            msg: 'Started measuring execution of create assertion from nquads',
            Event_name: 'resolve_create_assertion_from_nquads_start',
            Operation_name: 'resolve_create_assertion_from_nquads',
            Id_operation: operationId,
        });

        const assertion = await this.dataService.createAssertion(rawNquads);

        this.logger.emit({
            msg: 'Finished measuring execution of create assertion from nquads',
            Event_name: 'resolve_create_assertion_from_nquads_end',
            Operation_name: 'resolve_create_assertion_from_nquads',
            Id_operation: operationId,
        });

        this.logger.emit({
            msg: 'Started measuring execution of resolve verify assertion',
            Event_name: 'resolve_verify_assertion_start',
            Operation_name: 'resolve_verify_assertion',
            Id_operation: operationId,
        });

        const status = await this.dataService.verifyAssertion(
            assertion.jsonld,
            assertion.nquads,
            { isAsset: isAssetRequested },
        );

        this.logger.emit({
            msg: 'Finished measuring execution of resolve verify assertion',
            Event_name: 'resolve_verify_assertion_end',
            Operation_name: 'resolve_verify_assertion',
            Id_operation: operationId,
        });

        if (status && load) {
            await this.dataService.insert(rawNquads.join('\n'), `${constants.DID_PREFIX}:${assertion.jsonld.metadata.id}`);
            this.logger.info(`Assertion ${assertion.jsonld.metadata.id} has been successfully inserted`);
        }
        return status ? assertion : null;
    }

    async handleResolve(id) {
        if (this.dataService.isNodeBusy(constants.BUSYNESS_LIMITS.HANDLE_RESOLVE)) {
            return constants.NETWORK_RESPONSES.BUSY;
        }

        const operationId = uuidv1();
        this.logger.emit({
            msg: 'Started measuring execution of handle resolve command',
            Event_name: 'handle_resolve_start',
            Operation_name: 'handle_resolve',
            Id_operation: operationId,
        });

        const nquads = await this.dataService.resolve(id);
        if (nquads) {
            this.logger.info(`Number of n-quads retrieved from the database is ${nquads.length}`);
        }

        this.logger.emit({
            msg: 'Finished measuring execution of handle resolve command',
            Event_name: 'handle_resolve_end',
            Operation_name: 'handle_resolve',
            Id_operation: operationId,
        });

        if (!nquads) {
            return null;
        }
        return nquads;
    }

    async search(data, node) {
        const result = await this.networkService.sendMessage(
            constants.NETWORK_PROTOCOLS.SEARCH,
            data,
            node,
        );
        return result;
    }

    async handleSearch(request) {
        if (this.dataService.isNodeBusy(constants.BUSYNESS_LIMITS.HANDLE_SEARCH_ENTITIES)) {
            return constants.NETWORK_RESPONSES.BUSY;
        }

        const operationId = uuidv1();
        this.logger.emit({
            msg: 'Started measuring execution of handle search command',
            Event_name: 'handle_search_start',
            Operation_name: 'handle_search',
            Id_operation: operationId,
        });

        const {
            query,
            issuers,
            types,
            prefix,
            limit,
            handlerId,
        } = request;
        const response = await this.dataService.searchByQuery(query, {
            issuers,
            types,
            prefix,
            limit,
        });

        this.logger.emit({
            msg: 'Finished measuring execution of handle search command',
            Event_name: 'handle_search_end',
            Operation_name: 'handle_search',
            Id_operation: operationId,
        });

        return { response, handlerId };
    }

    async handleSearchResult(request) {
        if (request === constants.NETWORK_RESPONSES.BUSY) {
            return false;
        }

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
            const { jsonld } = await this.dataService.createAssertion(rawNquads);
            let object = handlerData.find(
                (x) => x.type === jsonld.metadata.type && x.id === jsonld.metadata.UALs[0],
            );
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
        const result = await this.networkService.sendMessage(
            constants.NETWORK_PROTOCOLS.SEARCH_ASSERTIONS,
            data,
            node,
        );
        return result;
    }

    async handleSearchAssertions(request) {
        if (this.dataService.isNodeBusy(constants.BUSYNESS_LIMITS.HANDLE_SEARCH_ASSERTIONS)) {
            return constants.NETWORK_RESPONSES.BUSY;
        }

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
        if (request === constants.NETWORK_RESPONSES.BUSY) {
            return false;
        }

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
                        // TODO: is set needed ?
                        assertion.nodes = [...new Set(assertion.nodes.concat(object.node))];
                    }
                } else {
                    if (!object || !object.nquads) {
                        continue;
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
