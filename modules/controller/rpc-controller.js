const express = require('express');
const fileUpload = require('express-fileupload');
const ipfilter = require('express-ipfilter').IpFilter;
const fs = require('fs');
const https = require('https');
const {IpDeniedError} = require('express-ipfilter');
const path = require('path')
const {v1: uuidv1, v4: uuidv4} = require('uuid');
const Models = require('../../models/index');
const constants = require('../constants');
const pjson = require('../../package.json');
const sortedStringify = require('json-stable-stringify');
const validator = require('validator');


class RpcController {
    constructor(ctx) {
        this.config = ctx.config;
        this.publishService = ctx.publishService;
        this.queryService = ctx.queryService;
        this.networkService = ctx.networkService;
        this.validationService = ctx.validationService;
        this.blockchainService = ctx.blockchainService;
        this.dataService = ctx.dataService;
        this.logger = ctx.logger;
        this.commandExecutor = ctx.commandExecutor;
        this.fileService = ctx.fileService;
        this.app = express();

        this.enableSSL();

        this.app.use(fileUpload({
            createParentPath: true,
        }));
    }

    async initialize() {
        this.startListeningForRpcNetworkCalls();

        this.initializeAuthenticationMiddleware();
        this.startListeningForRpcApiCalls();
        await this.initializeErrorMiddleware();
        if (this.sslEnabled) {
            await this.httpsServer.listen(this.config.rpcPort);
        } else {
            await this.app.listen(this.config.rpcPort);
        }

        this.logger.info(`RPC module enabled, server running on port ${this.config.rpcPort}`);
    }

    initializeAuthenticationMiddleware() {
        const formattedWhitelist = [];
        const ipv6prefix = '::ffff:';
        for (let i = 0; i < this.config.ipWhitelist.length; i += 1) {
            if (!this.config.ipWhitelist[i].includes(':')) {
                formattedWhitelist.push(ipv6prefix.concat(this.config.ipWhitelist[i]));
            } else {
                formattedWhitelist.push(this.config.ipWhitelist[i]);
            }
        }

        this.app.use(ipfilter(formattedWhitelist,
            {
                mode: 'allow',
                log: false,
            }));

        this.app.use((error, req, res, next) => {
            if (error instanceof IpDeniedError) {
                return res.status(401).send('Access denied')
            }
            return next();
        });

        this.app.use((req, res, next) => {
            this.logger.info(`${req.method}: ${req.url} request received`);
            return next();
        })
    }

    async initializeErrorMiddleware() {
        await this.app.use((error, req, res, next) => {
            let code, message;
            if (error && error.code) {
                switch (error.code) {
                    case 400:
                        code = 400
                        message = `Bad request. ${error.message}`
                        break;
                    default:
                        return next(error)
                }
                this.logger.error({ msg: message, Event_name: constants.ERROR_TYPE.API_ERROR_400 });
                return res.status(code).send(message);
            }
            return next(error)
        })

        this.app.use((error, req, res, next) => {
            this.logger.error({ msg: error,  Event_name: constants.ERROR_TYPE.API_ERROR_500});
            return res.status(500).send(error)
        })
    }

    enableSSL() {
        this.sslEnabled = fs.existsSync('/root/certs/privkey.pem') && fs.existsSync('/root/certs/fullchain.pem');

        if (this.sslEnabled) {
            this.httpsServer = https.createServer({
                key: fs.readFileSync('/root/certs/privkey.pem'),
                cert: fs.readFileSync('/root/certs/fullchain.pem'),
            }, this.app);
        }
    }

    startListeningForRpcNetworkCalls() {
        this.networkService.handleMessage('/store', (result) => this.publishService.handleStore(result));

        this.networkService.handleMessage('/resolve', (result) => this.queryService.handleResolve(result));

        this.networkService.handleMessage('/search', (result) => this.queryService.handleSearch(result), {
            async: true,
            timeout: 5e3,
        });

        this.networkService.handleMessage('/search/result', (result) => this.queryService.handleSearchResult(result));


        this.networkService.handleMessage('/search/assertions', (result) => this.queryService.handleSearchAssertions(result), {
            async: true,
            timeout: 5e3,
        });

        this.networkService.handleMessage('/search/assertions/result', (result) => this.queryService.handleSearchAssertionsResult(result));

        // this.networkService.handleMessage('/query', (result) => this.queryService.handleQuery(result));
    }

    startListeningForRpcApiCalls() {

        this.app.post('/publish', async (req, res, next) => {
            if (!req.files || !req.files.file || !req.body.assets) {
                return next({code: 400, message: 'File, assets, and keywords are required fields.'});
            }
            const operationId = uuidv1();
            try {
                this.logger.emit({
                    msg: 'Started measuring execution of publish command',
                    Event_name: 'publish_start',
                    Operation_name: 'publish',
                    Id_operation: operationId
                });

                const inserted_object = await Models.handler_ids.create({
                    status: 'PENDING',
                });
                const handlerId = inserted_object.dataValues.handler_id;
                res.status(200).send({
                    handler_id: handlerId,
                });

                const fileContent = req.files.file.data;
                const fileExtension = path.extname(req.files.file.name).toLowerCase();
                const assets = [...new Set(JSON.parse(req.body.assets.toLowerCase()))];
                let visibility = JSON.parse(!!req.body.visibility);
                let keywords = req.body.keywords ? JSON.parse(req.body.keywords.toLowerCase()) : [];

                const assertion = await this.publishService.publish(fileContent, fileExtension, assets, keywords, visibility, handlerId);

                const handlerData = {
                    id: assertion.id,
                    rootHash: assertion.rootHash,
                    signature: assertion.signature,
                    metadata: assertion.metadata,
                };

                await Models.handler_ids.update(
                    {
                        data: JSON.stringify(handlerData)
                    }, {
                        where: {
                            handler_id: handlerId,
                        },
                    },
                );

            } catch (e) {
                this.logger.error({
                    msg: `Unexpected error at publish route: ${e.message}. ${e.stack}`,
                    Event_name: constants.ERROR_TYPE.PUBLISH_ROUTE_ERROR,
                    Event_value1: e.message,
                    Id_operation: operationId
                });
            } finally {
                this.logger.emit({
                    msg: 'Finished measuring execution of publish command',
                    Event_name: 'publish_end',
                    Operation_name: 'publish',
                    Id_operation: operationId
                });
            }
        });

        this.app.get('/resolve', async (req, res, next) => {
            if (!req.query.ids) {
                return next({code: 400, message: 'Param ids is required.'});
            }
            const operationId = uuidv1();
            try {
                this.logger.emit({
                    msg: 'Started measuring execution of resolve command',
                    Event_name: 'resolve_start',
                    Operation_name: 'resolve',
                    Id_operation: operationId,
                });

                const inserted_object = await Models.handler_ids.create({
                    status: 'PENDING',
                });
                const handlerId = inserted_object.dataValues.handler_id;
                res.status(200).send({
                    handler_id: handlerId,
                });

                let assertionIds = [req.query.ids];
                if (req.query.ids instanceof Array) {
                    assertionIds = [...new Set(req.query.ids)];
                }
                this.logger.info(`Resolve for assertions ids: ${assertionIds} with handler id ${handlerId} initiated.`);
                const response = [];

                for (const assertionId of assertionIds) {
                    let namedGraph = await this.dataService.resolve(assertionId, true);
                    if (namedGraph) {
                        let {assertion, rdf} = await this.dataService.createAssertion(assertionId, namedGraph);
                        assertion.metadata = JSON.parse(sortedStringify(assertion.metadata))
                        assertion.data = JSON.parse(sortedStringify(await this.dataService.fromRDF(assertion.data, assertion.metadata.type)))
                        response.push({
                            [assertionId]: assertion
                        });
                    } else {
                        this.logger.info(`Searching for closest ${this.config.replicationFactor} node(s) for keyword ${assertionId}`);
                        let nodes = await this.networkService.findNodes(assertionId, this.config.replicationFactor);
                        if (nodes.length < this.config.replicationFactor)
                            this.logger.warn(`Found only ${nodes.length} node(s) for keyword ${assertionId}`);
                        nodes = [...new Set(nodes)];
                        for (const node of nodes) {
                            let {assertion} = await this.queryService.resolve(assertionId, node);
                            if (assertion) {
                                assertion.metadata = JSON.parse(sortedStringify(assertion.metadata));
                                assertion.data = JSON.parse(sortedStringify(await this.dataService.fromRDF(assertion.data, assertion.metadata.type)))
                                response.push({
                                    [assertionId]: assertion
                                });
                                break;
                            }
                        }
                    }
                }

                const handlerIdCachePath = this.fileService.getHandlerIdCachePath();

                await this.fileService
                    .writeContentsToFile(handlerIdCachePath, handlerId, JSON.stringify(response));

                await Models.handler_ids.update(
                    {
                        status: 'COMPLETED'
                    }, {
                        where: {
                            handler_id: handlerId,
                        },
                    },
                );

            } catch (e) {
                this.logger.error({
                    msg: `Unexpected error at resolve route: ${e.message}. ${e.stack}`,
                    Event_name: constants.ERROR_TYPE.RESOLVE_ROUTE_ERROR,
                    Event_value1: e.message,
                    Id_operation: operationId
                });
            } finally {
                this.logger.emit({
                    msg: 'Finished measuring execution of resolve command',
                    Event_name: 'resolve_end',
                    Operation_name: 'resolve',
                    Id_operation: operationId
                });
            }
        });

        this.app.get('/assertions::search', async (req, res, next) => {
            if (!req.query.query || req.params.search !== 'search') {
                return next({code: 400, message: 'Params query is necessary.'});
            }
            const operationId = uuidv1();
            try {
                this.logger.emit({
                    msg: 'Started measuring execution of search command',
                    Event_name: 'search_start',
                    Operation_name: 'search',
                    Id_operation: operationId
                });
                req.query.query = escape(req.query.query);
                const load = req.params.load ? req.params.load : false;

                const inserted_object = await Models.handler_ids.create({
                    status: 'PENDING',
                });
                const handlerId = inserted_object.dataValues.handler_id;
                res.status(200).send({
                    handler_id: handlerId,
                });

                let response;
                let nodes = [];
                response = await this.dataService.searchAssertions(req.query.query, { }, true);
                this.logger.info(`Searching for closest ${this.config.replicationFactor} node(s) for keyword ${req.query.query}`);
                let foundNodes = await this.networkService.findNodes(req.query.query, this.config.replicationFactor);
                if (foundNodes.length < this.config.replicationFactor)
                    this.logger.warn(`Found only ${foundNodes.length} node(s) for keyword ${req.query.query}`);
                nodes = nodes.concat(foundNodes);

                nodes = [...new Set(nodes)];
                const handlerIdCachePath = this.fileService.getHandlerIdCachePath();

                await this.fileService
                    .writeContentsToFile(handlerIdCachePath, handlerId, JSON.stringify(response));
                await Models.handler_ids.update(
                    {
                        status: 'PENDING'
                    }, {
                        where: {
                            handler_id: handlerId,
                        },
                    },
                );

                for (const node of nodes) {
                    await this.queryService.searchAssertions({
                        query: req.query.query,
                        load,
                        handlerId
                    }, node);
                }

            } catch (e) {
                this.logger.error({
                    msg: `Unexpected error at search assertions route: ${e.message}. ${e.stack}`,
                    Event_name: constants.ERROR_TYPE.SEARCH_ASSERTIONS_ROUTE_ERROR,
                    Event_value1: e.message,
                    Id_operation: operationId
                });
            } finally {
                this.logger.emit({
                    msg: 'Finished measuring execution of search command',
                    Event_name: 'search_end',
                    Operation_name: 'search',
                    Id_operation: operationId
                });
            }
        });

        this.app.get('/entities::search', async (req, res, next) => {
            if ((!req.query.query && !req.query.ids) || req.params.search !== 'search') {
                return next({code: 400, message: 'Params query or ids are necessary.'});
            }
            const operationId = uuidv1();
            try {
                this.logger.emit({
                    msg: 'Started measuring execution of search command',
                    Event_name: 'search_start',
                    Operation_name: 'search',
                    Id_operation: operationId
                });

                let query = escape(req.query.query), ids, issuers, types, prefix = req.query.prefix,
                    limit = req.query.limit,
                    framingCriteria = req.query.framingCriteria;

                if (req.query.ids) {
                    ids = [req.query.ids];
                    if (req.query.ids instanceof Array) {
                        ids = [...new Set(req.query.ids)];
                    }
                }

                if (req.query.issuers) {
                    issuers = [req.query.issuers];
                    if (req.query.issuers instanceof Array) {
                        issuers = [...new Set(req.query.issuers)];
                    }
                }

                if (req.query.types) {
                    types = [req.query.types];
                    if (req.query.types instanceof Array) {
                        types = [...new Set(req.query.types)];
                    }
                }

                if (!prefix) {
                    prefix = false;
                }

                if (!limit || limit < 1 || !Number(limit)) {
                    limit = 20;
                } else if (limit > 500) {
                    limit = 500;
                }

                const inserted_object = await Models.handler_ids.create({
                    status: 'PENDING',
                });
                const handlerId = inserted_object.dataValues.handler_id;
                res.status(200).send({
                    handler_id: handlerId,
                });

                let response;
                let nodes = [];
                if (query) {
                    response = await this.dataService.searchByQuery(query, {issuers, types, prefix, limit}, true);
                    this.logger.info(`Searching for closest ${this.config.replicationFactor} node(s) for keyword ${query}`);
                    nodes = await this.networkService.findNodes(query, this.config.replicationFactor);
                    if (nodes.length < this.config.replicationFactor)
                        this.logger.warn(`Found only ${nodes.length} node(s) for keyword ${query}`);
                } else {
                    response = await this.dataService.searchByIds(ids, {issuers, types, limit}, true);
                    for (const id of ids) {
                        this.logger.info(`Searching for closest ${this.config.replicationFactor} node(s) for keyword ${id}`);
                        let foundNodes = await this.networkService.findNodes(id, this.config.replicationFactor);
                        if (foundNodes.length < this.config.replicationFactor)
                            this.logger.warn(`Found only ${foundNodes.length} node(s) for keyword ${id}`);
                        nodes = nodes.concat(foundNodes);
                    }
                    nodes = [...new Set(nodes)];
                }
                const handlerIdCachePath = this.fileService.getHandlerIdCachePath();

                await this.fileService
                    .writeContentsToFile(handlerIdCachePath, handlerId, JSON.stringify(response));

                await Models.handler_ids.update(
                    {
                        status: 'PENDING'
                    }, {
                        where: {
                            handler_id: handlerId,
                        },
                    },
                );
                for (const node of nodes) {
                    await this.queryService.search({
                        query,
                        ids,
                        issuers,
                        types,
                        prefix,
                        limit,
                        handlerId
                    }, node);
                }

            } catch (e) {
                this.logger.error({
                    msg: `Unexpected error at search entities route: ${e.message}. ${e.stack}`,
                    Event_name: constants.ERROR_TYPE.SEARCH_ENTITIES_ROUTE_ERROR,
                    Event_value1: e.message,
                    Id_operation: operationId
                });
            } finally {
                this.logger.emit({
                    msg: 'Finished measuring execution of search command',
                    Event_name: 'search_end',
                    Operation_name: 'search',
                    Id_operation: operationId
                });
            }
        });

        this.app.post('/query', async (req, res, next) => {
            if (!req.body.query || !req.query.type) {
                return next({code: 400, message: 'Params query and type are necessary.'});
            }
            // Handle allowed query types, TODO: expand to select, ask and construct
            if (req.query.type !== 'construct') {
                return next({code: 400, message: 'Unallowed query type, currently supported types: construct'});
            }
            const operationId = uuidv1();
            try {
                this.logger.emit({
                    msg: 'Started measuring execution of query command',
                    Event_name: 'query_start',
                    Operation_name: 'query',
                    Id_operation: operationId,
                    Event_value1: req.query.type
                });

                const inserted_object = await Models.handler_ids.create({
                    status: 'PENDING',
                });
                const handlerId = inserted_object.dataValues.handler_id;
                res.status(200).send({
                    handler_id: handlerId,
                });
                try {
                    let response = await this.dataService.runQuery(req.body.query, req.query.type.toUpperCase());

                    const handlerIdCachePath = this.fileService.getHandlerIdCachePath();

                    await this.fileService
                        .writeContentsToFile(handlerIdCachePath, handlerId, JSON.stringify(response));

                    await Models.handler_ids.update(
                        {
                            status: 'COMPLETED'
                        }, {
                            where: {
                                handler_id: handlerId,
                            },
                        },
                    );
                } catch (e) {
                    await Models.handler_ids.update(
                        {
                            status: 'FAILED',
                            data: JSON.stringify({errorMessage: e.message})
                        }, {
                            where: {
                                handler_id: handlerId,
                            },
                        },
                    );
                    throw e;
                }
            } catch (e) {
                this.logger.error({
                    msg: `Unexpected error at query route:: ${e.message}. ${e.stack}`,
                    Event_name: constants.ERROR_TYPE.QUERY_ROUTE_ERROR,
                    Event_value1: e.message,
                    Id_operation: operationId
                });
            } finally {
                this.logger.emit({
                    msg: 'Finished measuring execution of query command',
                    Event_name: 'query_end',
                    Operation_name: 'query',
                    Id_operation: operationId,
                    Event_value1: req.query.type
                });
            }
        });

        this.app.post('/proofs::get', async (req, res, next) => {
            if (!req.body.nquads) {
                return next({code: 400, message: 'Params query and type are necessary.'});
            }
            const operationId = uuidv1();
            try {
                this.logger.emit({
                    msg: 'Started measuring execution of proofs command',
                    Event_name: 'proofs_start',
                    Operation_name: 'proofs',
                    Id_operation: operationId
                });

                const inserted_object = await Models.handler_ids.create({
                    status: 'PENDING',
                });
                const handlerId = inserted_object.dataValues.handler_id;
                res.status(200).send({
                    handler_id: handlerId,
                });
                let assertions;
                if (req.query.assertions) {
                    assertions = [req.query.assertions];
                    if (req.query.assertions instanceof Array) {
                        assertions = [...new Set(req.query.assertions)];
                    }
                }

                const nquads = JSON.parse(req.body.nquads);

                const result = [];
                if (!assertions || assertions.length === 0) {
                    assertions = await this.dataService.findAssertions(nquads);
                }
                for (const assertionId of assertions) {
                    const content = await this.dataService.resolve(assertionId)
                    if (content) {
                        const {rdf} = await this.dataService.createAssertion(assertionId, content);
                        const proofs = await this.validationService.getProofs(rdf, nquads);
                        result.push({assertionId, proofs});
                    }
                }

                const handlerIdCachePath = this.fileService.getHandlerIdCachePath();

                await this.fileService
                    .writeContentsToFile(handlerIdCachePath, handlerId, JSON.stringify(result));

                await Models.handler_ids.update(
                    {
                        status: 'COMPLETED',
                    }, {
                        where: {
                            handler_id: handlerId
                        },
                    },
                );
            } catch (e) {
                this.logger.error({
                    msg: `Unexpected error at proofs route: ${e.message}. ${e.stack}`,
                    Event_name: constants.ERROR_TYPE.PROOFS_ROUTE_ERROR,
                    Event_value1: e.message,
                    Id_operation: operationId
                });
            } finally {
                this.logger.emit({
                    msg: 'Finished measuring execution of proofs command',
                    Event_name: 'proofs_end',
                    Operation_name: 'proofs',
                    Id_operation: operationId
                });
            }
        });

        this.app.get('/:operation/result/:handler_id', async (req, res, next) => {
            if (!['publish', 'resolve', 'query', 'entities:search', 'assertions:search', 'proofs:get'].includes(req.params.operation)) {
                return next({
                    code: 400,
                    message: 'Unexisting operation, available operations are: publish, resolve, query, proofs and search'
                });
            }

            const {handler_id, operation} = req.params;
            if (!validator.isUUID(handler_id)) {
                return next({
                    code: 400,
                    message: 'Handler id is in wrong format'
                });
            }

            try {
                const handlerData = await Models.handler_ids.findOne({
                    where: {
                        handler_id,
                    },
                });

                let response;
                if (handlerData) {
                    const documentPath = this.fileService.getHandlerIdDocumentPath(handler_id);
                    switch (req.params.operation) {
                        case 'entities:search':
                                handlerData.data = await this.fileService.loadJsonFromFile(documentPath);

                            response = handlerData.data.map(async (x) => ({
                                "@type": "EntitySearchResult",
                                "result": {
                                    "@id": x.id,
                                    "@type": x.type.toUpperCase(),
                                    ...(await this.dataService.frameAsset(x.data, x.type))
                                },
                                "issuers": x.issuers,
                                "assertions": x.assertions,
                                "nodes": x.nodes,
                                "resultScore": 0
                            }));

                            response = await Promise.all(response);

                            res.send({
                                "@context": {
                                    "@vocab": "http://schema.org/",
                                    "goog": "http://schema.googleapis.com/",
                                    "resultScore": "goog:resultScore",
                                    "detailedDescription": "goog:detailedDescription",
                                    "EntitySearchResult": "goog:EntitySearchResult",
                                    "kg": "http://g.co/kg"
                                },
                                "@type": "ItemList",
                                "itemListElement": response
                            });
                            break;
                        case 'assertions:search':
                                handlerData.data = await this.fileService.loadJsonFromFile(documentPath);

                            response = handlerData.data.map(async (x) => ({
                                "@type": "AssertionSearchResult",
                                "result": {
                                    "@id": x.id,
                                    "metadata": x.metadata,
                                    "signature": x.signature,
                                    "rootHash": x.rootHash
                                },
                                "nodes": x.nodes,
                                "resultScore": 0
                            }));

                            response = await Promise.all(response);

                            res.send({
                                "@context": {
                                    "@vocab": "http://schema.org/",
                                    "goog": "http://schema.googleapis.com/",
                                    "resultScore": "goog:resultScore",
                                    "detailedDescription": "goog:detailedDescription",
                                    "EntitySearchResult": "goog:EntitySearchResult",
                                    "kg": "http://g.co/kg"
                                },
                                "@type": "ItemList",
                                "itemListElement": response
                            });
                            break;
                        case 'publish':
                            const result = {};
                            if (handlerData.data) {
                                const {rdf, assertion} = await this.fileService.loadJsonFromFile(documentPath);
                                result.data = JSON.parse(handlerData.data);
                                result.data.rdf = rdf;
                                result.data.assertion = assertion;
                            }
                            res.status(200).send({status: handlerData.status, data: result.data});
                            break;
                        default:
                                handlerData.data = await this.fileService.loadJsonFromFile(documentPath);

                            res.status(200).send({status: handlerData.status, data: handlerData.data});
                            break;
                    }

                } else {
                    next({code: 404, message: `Handler with id: ${handler_id} does not exist.`});
                }

            } catch (e) {
                this.logger.error({
                    msg: `Error while trying to fetch ${operation} data for handler id ${handler_id}. Error message: ${e.message}. ${e.stack}`,
                    Event_name: constants.ERROR_TYPE.RESULTS_ROUTE_ERROR,
                    Event_value1: e.message,
                    Id_operation: handler_id
                });
                next({code: 400, message: `Unexpected error at getting results: ${e}`});
            }
        });

        this.app.get('/info', async (req, res, next) => {
            try {
                let version = pjson.version;

                res.status(200).send({
                    version,
                    auto_update: this.config.autoUpdate.enabled,
                    telemetry: this.config.telemetryHub.enabled,
                });
            } catch (e) {
                this.logger.emit({
                    msg: 'Telemetry logging error at node info route',
                    Operation_name: 'Error',
                    Event_name: constants.ERROR_TYPE.NODE_INFO_ROUTE_ERROR,
                    Event_value1: e.message,
                    Id_operation: 'Undefined'
                });
                return next({code: 400, message: `Error while fetching node info: ${e}. ${e.stack}`});
            }
        });
    }
}

module.exports = RpcController;
