const express = require('express');
const fileUpload = require('express-fileupload');
const ipfilter = require('express-ipfilter').IpFilter;
const fs = require('fs');
const https = require('https');
const { IpDeniedError } = require('express-ipfilter');
const { v1: uuidv1 } = require('uuid');
const validator = require('validator');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const Models = require('../../models/index');
const constants = require('../constants');
const pjson = require('../../package.json');

class RpcController {
    constructor(ctx) {
        this.config = ctx.config;
        this.publishService = ctx.publishService;
        this.queryService = ctx.queryService;
        this.networkModuleManager = ctx.networkModuleManager;
        this.validationModuleManager = ctx.validationModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.dataService = ctx.dataService;
        this.logger = ctx.logger;
        this.commandExecutor = ctx.commandExecutor;
        this.fileService = ctx.fileService;
        this.workerPool = ctx.workerPool;
        this.publishController = ctx.publishController;
        this.app = express();

        this.enableSSL();

        this.app.use(
            fileUpload({
                createParentPath: true,
            }),
        );
    }

    async initialize() {
        // TODO add body-parser middleware
        this.initializeNetworkApi();

        this.initializeAuthenticationMiddleware();
        this.initializeRateLimitMiddleware();
        this.initializeSlowDownMiddleWare();
        this.initializeServiceApi();
        await this.initializeErrorMiddleware();
        if (this.sslEnabled) {
            await this.httpsServer.listen(this.config.rpcPort);
        } else {
            await this.app.listen(this.config.rpcPort);
        }
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

        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header(
                'Access-Control-Allow-Headers',
                'Origin, X-Requested-With, Content-Type, Accept',
            );
            next();
        });

        this.app.use(
            ipfilter(formattedWhitelist, {
                mode: 'allow',
                log: false,
            }),
        );

        this.app.use((error, req, res, next) => {
            if (error instanceof IpDeniedError) {
                return res.status(401).send('Access denied');
            }
            return next();
        });

        this.app.use((req, res, next) => {
            this.logger.info(`${req.method}: ${req.url} request received`);
            return next();
        });
    }

    async initializeErrorMiddleware() {
        await this.app.use((error, req, res, next) => {
            let code;
            let message;
            if (error && error.code) {
                switch (error.code) {
                    case 400:
                        code = 400;
                        message = `Bad request. ${error.message}`;
                        break;
                    default:
                        return next(error);
                }
                this.logger.error({ msg: message, Event_name: constants.ERROR_TYPE.API_ERROR_400 });
                return res.status(code).send(message);
            }
            return next(error);
        });

        this.app.use((error, req, res) => {
            this.logger.error({ msg: error, Event_name: constants.ERROR_TYPE.API_ERROR_500 });
            return res.status(500).send(error);
        });
    }

    enableSSL() {
        this.sslEnabled =
            fs.existsSync('/root/certs/privkey.pem') && fs.existsSync('/root/certs/fullchain.pem');

        if (this.sslEnabled) {
            this.httpsServer = https.createServer(
                {
                    key: fs.readFileSync('/root/certs/privkey.pem'),
                    cert: fs.readFileSync('/root/certs/fullchain.pem'),
                },
                this.app,
            );
        }
    }

    initializeRateLimitMiddleware() {
        this.rateLimitMiddleware = rateLimit({
            windowMs: constants.SERVICE_API_RATE_LIMIT.TIME_WINDOW_MILLS,
            max: constants.SERVICE_API_RATE_LIMIT.MAX_NUMBER,
            message: `Too many requests sent, maximum number of requests per minute is ${constants.SERVICE_API_RATE_LIMIT.MAX_NUMBER}`,
            standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
            legacyHeaders: false, // Disable the `X-RateLimit-*` headers
        });
    }

    initializeSlowDownMiddleWare() {
        this.slowDownMiddleware = slowDown({
            windowMs: constants.SERVICE_API_SLOW_DOWN.TIME_WINDOW_MILLS,
            delayAfter: constants.SERVICE_API_SLOW_DOWN.DELAY_AFTER_SECONDS,
            delayMs: constants.SERVICE_API_SLOW_DOWN.DELAY_MILLS,
        });
    }

    initializeNetworkApi() {
        this.logger.info(`Network API module enabled on port ${this.config.network.port}`);

        this.networkModuleManager.handleMessage(
            constants.NETWORK_PROTOCOLS.STORE,
            (message, remotePeerId) =>
                this.publishController.handleNetworkStoreRequest(message, remotePeerId),
        );

        this.networkModuleManager.handleMessage(
            constants.NETWORK_PROTOCOLS.RESOLVE,
            (message, remotePeerId) =>
                this.resolveController.handleNetworkResolveRequest(message, remotePeerId),
        )

        this.networkModuleManager.handleMessage(
            constants.NETWORK_PROTOCOLS.SEARCH,
            (result) => this.queryService.handleSearch(result),
            {
                async: true,
                timeout: constants.NETWORK_HANDLER_TIMEOUT,
            },
        );

        this.networkModuleManager.handleMessage(
            constants.NETWORK_PROTOCOLS.SEARCH_RESULT,
            (result) => this.queryService.handleSearchResult(result),
        );

        this.networkModuleManager.handleMessage(
            constants.NETWORK_PROTOCOLS.SEARCH_ASSERTIONS,
            (result) => this.queryService.handleSearchAssertions(result),
            {
                async: true,
                timeout: constants.NETWORK_HANDLER_TIMEOUT,
            },
        );

        this.networkModuleManager.handleMessage(
            constants.NETWORK_PROTOCOLS.SEARCH_ASSERTIONS_RESULT,
            (result) => this.queryService.handleSearchAssertionsResult(result),
        );

        // this.networkService.handleMessage('/query', (result)
        // => this.queryService.handleQuery(result));
    }

    initializeServiceApi() {
        this.logger.info(
            `Service API module enabled, server running on port ${this.config.rpcPort}`,
        );

        this.app.post(
            constants.SERVICE_API_ROUTES.PUBLISH,
            this.rateLimitMiddleware,
            this.slowDownMiddleware,
            async (req, res) => {
                await this.publishController.handleHttpApiPublishRequest(req, res);
            },
        );

        this.app.post(
            constants.SERVICE_API_ROUTES.PROVISION,
            this.rateLimitMiddleware,
            this.slowDownMiddleware,
            async (req, res) => {
                await this.publishController.handleHttpApiProvisionRequest(req, res);
            },
        );

        this.app.post(
            constants.SERVICE_API_ROUTES.UPDATE,
            this.rateLimitMiddleware,
            this.slowDownMiddleware,
            async (req, res, next) => {
                if (!req.body.ual) {
                    return next({
                        code: 400,
                        message: 'UAL must be a string.',
                    });
                }
                await this.publishController.handleHttpApiUpdateRequest(req, res);
            },
        );

        this.app.get(
            constants.SERVICE_API_ROUTES.RESOLVE,
            this.rateLimitMiddleware,
            this.slowDownMiddleware,
            async (req, res) => {
                await this.resolveController.handleHttpApiResolveRequest(req, res);
            },
        );

        this.app.get(
            constants.SERVICE_API_ROUTES.SEARCH_ASSERTIONS,
            this.rateLimitMiddleware,
            this.slowDownMiddleware,
            async (req, res, next) => {
                if (!req.query.query || req.params.search !== 'search') {
                    return next({ code: 400, message: 'Params query is necessary.' });
                }

                let { prefix } = req.query;
                let { limit } = req.query;
                const query = req.query.query.toLowerCase();

                if (!prefix) {
                    prefix = false;
                }

                if (!limit || limit < 1 || !Number(limit)) {
                    limit = 20;
                } else if (limit > 500) {
                    limit = 500;
                }

                const operationId = uuidv1();
                let handlerId = null;
                try {
                    this.logger.emit({
                        msg: 'Started measuring execution of search command',
                        Event_name: 'search_start',
                        Operation_name: 'search',
                        Id_operation: operationId,
                    });
                    const inserted_object = await Models.handler_ids.create({
                        status: 'PENDING',
                    });
                    handlerId = inserted_object.dataValues.handler_id;
                    res.status(202).send({
                        handler_id: handlerId,
                    });

                    const response = await this.dataService.searchAssertions(
                        query,
                        { limit, prefix },
                        true,
                    );
                    const handlerIdCachePath = this.fileService.getHandlerIdCachePath();

                    await this.fileService.writeContentsToFile(
                        handlerIdCachePath,
                        handlerId,
                        JSON.stringify(response),
                    );
                    await Models.handler_ids.update(
                        {
                            status: 'COMPLETED',
                        },
                        {
                            where: {
                                handler_id: handlerId,
                            },
                        },
                    );

                    this.logger.info(
                        `Searching for closest ${this.config.replicationFactor} node(s) for keyword ${query}`,
                    );
                    const Id_operation = uuidv1();
                    this.logger.emit({
                        msg: 'Started measuring execution of find nodes',
                        Event_name: 'find_nodes_start',
                        Operation_name: 'find_nodes',
                        Id_operation,
                    });
                    this.logger.emit({
                        msg: 'Started measuring execution of kad find nodes',
                        Event_name: 'kad_find_nodes_start',
                        Operation_name: 'find_nodes',
                        Id_operation,
                    });
                    const foundNodes = await this.networkModuleManager.findNodes(
                        query,
                        constants.NETWORK_PROTOCOLS.SEARCH_ASSERTIONS,
                    );
                    this.logger.emit({
                        msg: 'Finished measuring execution of kad find nodes ',
                        Event_name: 'kad_find_nodes_end',
                        Operation_name: 'find_nodes',
                        Id_operation,
                    });
                    this.logger.emit({
                        msg: 'Started measuring execution of rank nodes',
                        Event_name: 'rank_nodes_start',
                        Operation_name: 'find_nodes',
                        Id_operation,
                    });
                    let nodes = await this.networkModuleManager.rankNodes(
                        foundNodes,
                        query,
                        this.config.replicationFactor,
                    );
                    this.logger.emit({
                        msg: 'Finished measuring execution of rank nodes',
                        Event_name: 'rank_nodes_end',
                        Operation_name: 'find_nodes',
                        Id_operation,
                    });
                    this.logger.emit({
                        msg: 'Finished measuring execution of find nodes',
                        Event_name: 'find_nodes_end',
                        Operation_name: 'find_nodes',
                        Id_operation,
                    });
                    if (nodes.length < this.config.replicationFactor) {
                        this.logger.warn(`Found only ${nodes.length} node(s) for keyword ${query}`);
                    }

                    nodes = [...new Set(nodes)];
                    const searchPromises = nodes.map((node) =>
                        this.queryService.searchAssertions(
                            {
                                query,
                                options: { limit, prefix },
                                handlerId,
                            },
                            node,
                        ),
                    );
                    await Promise.allSettled(searchPromises);
                } catch (e) {
                    this.logger.error({
                        msg: `Unexpected error at search assertions route: ${e.message}. ${e.stack}`,
                        Event_name: constants.ERROR_TYPE.SEARCH_ASSERTIONS_ROUTE_ERROR,
                        Event_value1: e.message,
                        Id_operation: operationId,
                    });
                    this.updateFailedHandlerId(handlerId, e, next);
                } finally {
                    this.logger.emit({
                        msg: 'Finished measuring execution of search command',
                        Event_name: 'search_end',
                        Operation_name: 'search',
                        Id_operation: operationId,
                    });
                }
            },
        );

        this.app.get(
            constants.SERVICE_API_ROUTES.SEARCH,
            this.rateLimitMiddleware,
            this.slowDownMiddleware,
            async (req, res, next) => {
                if (!req.query.query || req.params.search !== 'search') {
                    return next({ code: 400, message: 'Params query or ids are necessary.' });
                }
                const operationId = uuidv1();
                let handlerId = null;
                try {
                    this.logger.emit({
                        msg: 'Started measuring execution of search command',
                        Event_name: 'search_start',
                        Operation_name: 'search',
                        Id_operation: operationId,
                    });

                    const query = req.query.query.toLowerCase();
                    let issuers;
                    let types;
                    let { prefix } = req.query;
                    let { limit } = req.query;

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
                    handlerId = inserted_object.dataValues.handler_id;
                    res.status(200).send({
                        handler_id: handlerId,
                    });

                    let response;
                    let nodes = [];
                    if (query) {
                        response = await this.dataService.searchByQuery(
                            query,
                            {
                                issuers,
                                types,
                                prefix,
                                limit,
                            },
                            true,
                        );
                        this.logger.info(
                            `Searching for closest ${this.config.replicationFactor} node(s) for keyword ${query}`,
                        );

                        const Id_operation = uuidv1();
                        this.logger.emit({
                            msg: 'Started measuring execution of find nodes',
                            Event_name: 'find_nodes_start',
                            Operation_name: 'find_nodes',
                            Id_operation,
                        });
                        this.logger.emit({
                            msg: 'Started measuring execution of kad find nodes',
                            Event_name: 'kad_find_nodes_start',
                            Operation_name: 'find_nodes',
                            Id_operation,
                        });
                        const foundNodes = await this.networkModuleManager.findNodes(
                            query,
                            constants.NETWORK_PROTOCOLS.SEARCH,
                        );
                        this.logger.emit({
                            msg: 'Finished measuring execution of kad find nodes ',
                            Event_name: 'kad_find_nodes_end',
                            Operation_name: 'find_nodes',
                            Id_operation,
                        });
                        this.logger.emit({
                            msg: 'Started measuring execution of rank nodes',
                            Event_name: 'rank_nodes_start',
                            Operation_name: 'find_nodes',
                            Id_operation,
                        });
                        nodes = await this.networkModuleManager.rankNodes(
                            foundNodes,
                            query,
                            this.config.replicationFactor,
                        );
                        this.logger.emit({
                            msg: 'Finished measuring execution of rank nodes',
                            Event_name: 'rank_nodes_end',
                            Operation_name: 'find_nodes',
                            Id_operation,
                        });
                        this.logger.emit({
                            msg: 'Finished measuring execution of find nodes',
                            Event_name: 'find_nodes_end',
                            Operation_name: 'find_nodes',
                            Id_operation,
                        });
                        if (nodes.length < this.config.replicationFactor) {
                            this.logger.warn(
                                `Found only ${nodes.length} node(s) for keyword ${query}`,
                            );
                        }
                    }
                    const handlerIdCachePath = this.fileService.getHandlerIdCachePath();

                    await this.fileService.writeContentsToFile(
                        handlerIdCachePath,
                        handlerId,
                        JSON.stringify(response),
                    );

                    await Models.handler_ids.update(
                        {
                            status: 'COMPLETED',
                        },
                        {
                            where: {
                                handler_id: handlerId,
                            },
                        },
                    );
                    const searchPromises = nodes.map((node) =>
                        this.queryService.search(
                            {
                                query,
                                issuers,
                                types,
                                prefix,
                                limit,
                                handlerId,
                            },
                            node,
                        ),
                    );
                    await Promise.allSettled(searchPromises);
                } catch (e) {
                    this.logger.error({
                        msg: `Unexpected error at search entities route: ${e.message}. ${e.stack}`,
                        Event_name: constants.ERROR_TYPE.SEARCH_ENTITIES_ROUTE_ERROR,
                        Event_value1: e.message,
                        Id_operation: operationId,
                    });
                    this.updateFailedHandlerId(handlerId, e, next);
                } finally {
                    this.logger.emit({
                        msg: 'Finished measuring execution of search command',
                        Event_name: 'search_end',
                        Operation_name: 'search',
                        Id_operation: operationId,
                    });
                }
            },
        );

        this.app.post(
            constants.SERVICE_API_ROUTES.QUERY,
            this.rateLimitMiddleware,
            this.slowDownMiddleware,
            async (req, res, next) => {
                if (!req.body || !req.body.query || !req.body.type) {
                    return next({ code: 400, message: 'Params query and type are necessary.' });
                }

                const { query, type: queryType } = req.body;

                const allowedQueries = ['construct', 'select'];
                // Handle allowed query types, TODO: expand to select, ask and construct
                if (!allowedQueries.includes(queryType.toLowerCase())) {
                    return next({
                        code: 400,
                        message: `Unallowed query type, currently supported types: ${allowedQueries.join(
                            ', ',
                        )}`,
                    });
                }
                const operationId = uuidv1();
                let handlerId = null;
                try {
                    this.logger.emit({
                        msg: 'Started measuring execution of query command',
                        Event_name: 'query_start',
                        Operation_name: 'query',
                        Id_operation: operationId,
                        Event_value1: queryType,
                    });

                    const inserted_object = await Models.handler_ids.create({
                        status: 'PENDING',
                    });
                    handlerId = inserted_object.dataValues.handler_id;
                    res.status(200).send({
                        handler_id: handlerId,
                    });
                    try {
                        const response = await this.dataService.runQuery(
                            query,
                            queryType.toUpperCase(),
                        );

                        const handlerIdCachePath = this.fileService.getHandlerIdCachePath();
                        if (response) {
                            await this.fileService.writeContentsToFile(
                                handlerIdCachePath,
                                handlerId,
                                JSON.stringify(response),
                            );
                        }

                        await Models.handler_ids.update(
                            {
                                status: 'COMPLETED',
                            },
                            {
                                where: {
                                    handler_id: handlerId,
                                },
                            },
                        );
                    } catch (e) {
                        this.updateFailedHandlerId(handlerId, e, next);
                    }
                } catch (e) {
                    this.logger.error({
                        msg: `Unexpected error at query route: ${e.message}. ${e.stack}`,
                        Event_name: constants.ERROR_TYPE.QUERY_ROUTE_ERROR,
                        Event_value1: e.message,
                        Id_operation: operationId,
                    });
                } finally {
                    this.logger.emit({
                        msg: 'Finished measuring execution of query command',
                        Event_name: 'query_end',
                        Operation_name: 'query',
                        Id_operation: operationId,
                        Event_value1: queryType,
                    });
                }
            },
        );

        this.app.post(
            constants.SERVICE_API_ROUTES.PROOFS,
            this.rateLimitMiddleware,
            this.slowDownMiddleware,
            async (req, res, next) => {
                if (!req.body.nquads) {
                    return next({ code: 400, message: 'Params query and type are necessary.' });
                }
                const operationId = uuidv1();
                const handlerIdCachePath = this.fileService.getHandlerIdCachePath();
                let handlerId = null;
                try {
                    this.logger.emit({
                        msg: 'Started measuring execution of proofs command',
                        Event_name: 'proofs_start',
                        Operation_name: 'proofs',
                        Id_operation: operationId,
                    });

                    const inserted_object = await Models.handler_ids.create({
                        status: 'PENDING',
                    });
                    handlerId = inserted_object.dataValues.handler_id;
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
                    const reqNquads = JSON.parse(req.body.nquads);

                    const result = [];
                    if (!assertions || assertions.length === 0) {
                        assertions = await this.dataService.findAssertions(reqNquads);
                    }
                    for (const assertionId of assertions) {
                        const rawNquads = await this.dataService.resolve(assertionId);
                        if (rawNquads) {
                            const { nquads } = await this.dataService.createAssertion(rawNquads);
                            const proofs = await this.validationModuleManager.getProofs(
                                nquads,
                                reqNquads,
                            );
                            result.push({ assertionId, proofs });
                        }
                    }

                    await this.fileService.writeContentsToFile(
                        handlerIdCachePath,
                        handlerId,
                        JSON.stringify(result),
                    );

                    await Models.handler_ids.update(
                        {
                            status: 'COMPLETED',
                        },
                        {
                            where: {
                                handler_id: handlerId,
                            },
                        },
                    );
                } catch (e) {
                    this.logger.error({
                        msg: `Unexpected error at proofs route: ${e.message}. ${e.stack}`,
                        Event_name: constants.ERROR_TYPE.PROOFS_ROUTE_ERROR,
                        Event_value1: e.message,
                        Id_operation: operationId,
                    });
                    this.updateFailedHandlerId(handlerId, e, next);
                } finally {
                    this.logger.emit({
                        msg: 'Finished measuring execution of proofs command',
                        Event_name: 'proofs_end',
                        Operation_name: 'proofs',
                        Id_operation: operationId,
                    });
                }
            },
        );

        this.app.get(constants.SERVICE_API_ROUTES.OPERATION_RESULT, async (req, res, next) => {
            if (
                ![
                    'provision',
                    'update',
                    'publish',
                    'resolve',
                    'query',
                    'entities:search',
                    'assertions:search',
                    'proofs:get',
                ].includes(req.params.operation)
            ) {
                return next({
                    code: 400,
                    message:
                        'Unexisting operation, available operations are: provision, update, publish, resolve, entities:search, assertions:search, query and proofs:get',
                });
            }

            const { handler_id, operation } = req.params;
            if (!validator.isUUID(handler_id)) {
                return next({
                    code: 400,
                    message: 'Handler id is in wrong format',
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
                    if (handlerData.status === 'FAILED') {
                        return res.status(200).send({
                            status: handlerData.status,
                            data: JSON.parse(handlerData.data),
                        });
                    }
                    const documentPath = this.fileService.getHandlerIdDocumentPath(handler_id);
                    switch (req.params.operation) {
                        case 'entities:search':
                            if (handlerData && handlerData.status === 'COMPLETED') {
                                handlerData.data = await this.fileService.loadJsonFromFile(
                                    documentPath,
                                );
                            } else {
                                handlerData.data = [];
                            }

                            response = handlerData.data.map((x) => ({
                                '@type': 'EntitySearchResult',
                                result: {
                                    '@id': x.id,
                                    '@type': x.type.toUpperCase(),
                                    timestamp: x.timestamp,
                                },
                                issuers: x.issuers,
                                assertions: x.assertions,
                                nodes: x.nodes,
                                resultScore: 0,
                            }));

                            res.send({
                                '@context': {
                                    '@vocab': 'http://schema.org/',
                                    goog: 'http://schema.googleapis.com/',
                                    resultScore: 'goog:resultScore',
                                    detailedDescription: 'goog:detailedDescription',
                                    EntitySearchResult: 'goog:EntitySearchResult',
                                    kg: 'http://g.co/kg',
                                },
                                '@type': 'ItemList',
                                itemCount: response.length,
                                itemListElement: response,
                            });
                            break;
                        case 'assertions:search':
                            if (handlerData && handlerData.status === 'COMPLETED') {
                                handlerData.data = await this.fileService.loadJsonFromFile(
                                    documentPath,
                                );
                            } else {
                                handlerData.data = [];
                            }

                            response = handlerData.data.map(async (x) => ({
                                '@type': 'AssertionSearchResult',
                                result: {
                                    '@id': x.id,
                                    metadata: x.metadata,
                                    signature: x.signature,
                                    rootHash: x.rootHash,
                                },
                                nodes: x.nodes,
                                resultScore: 0,
                            }));

                            response = await Promise.all(response);

                            res.send({
                                '@context': {
                                    '@vocab': 'http://schema.org/',
                                    goog: 'http://schema.googleapis.com/',
                                    resultScore: 'goog:resultScore',
                                    detailedDescription: 'goog:detailedDescription',
                                    EntitySearchResult: 'goog:EntitySearchResult',
                                    kg: 'http://g.co/kg',
                                },
                                '@type': 'ItemList',
                                itemCount: response.length,
                                itemListElement: response,
                            });
                            break;
                        case 'resolve':
                            if (handlerData && handlerData.status === 'COMPLETED') {
                                handlerData.data = await this.fileService.loadJsonFromFile(
                                    documentPath,
                                );
                            }
                            res.status(200).send({
                                status: handlerData.status,
                                data: handlerData.data,
                            });
                            break;
                        case 'provision':
                        case 'publish':
                        case 'update':
                            if (handlerData && handlerData.status === 'COMPLETED') {
                                const result = await this.fileService.loadJsonFromFile(
                                    documentPath,
                                );
                                delete result.assertion.data;
                                handlerData.data = result.assertion;
                            }
                            res.status(200).send({
                                status: handlerData.status,
                                data: handlerData.data,
                            });
                            break;
                        default:
                            if (handlerData && handlerData.status === 'COMPLETED') {
                                handlerData.data = await this.fileService.loadJsonFromFile(
                                    documentPath,
                                );
                            }

                            res.status(200).send({
                                status: handlerData.status,
                                data: handlerData.data,
                            });
                            break;
                    }
                } else {
                    next({ code: 404, message: `Handler with id: ${handler_id} does not exist.` });
                }
            } catch (e) {
                this.logger.error({
                    msg: `Error while trying to fetch ${operation} data for handler id ${handler_id}. Error message: ${e.message}. ${e.stack}`,
                    Event_name: constants.ERROR_TYPE.RESULTS_ROUTE_ERROR,
                    Event_value1: e.message,
                    Id_operation: handler_id,
                });
                next({ code: 400, message: `Unexpected error at getting results: ${e}` });
            }
        });

        this.app.get(constants.SERVICE_API_ROUTES.INFO, async (req, res, next) => {
            try {
                const { version } = pjson;

                res.status(200).send({
                    version,
                    auto_update: this.config.modules.autoUpdater.enabled,
                    telemetry: this.config.telemetryHub.enabled,
                });
            } catch (e) {
                this.logger.emit({
                    msg: 'Telemetry logging error at node info route',
                    Operation_name: 'Error',
                    Event_name: constants.ERROR_TYPE.NODE_INFO_ROUTE_ERROR,
                    Event_value1: e.message,
                    Id_operation: 'Undefined',
                });
                return next({
                    code: 400,
                    message: `Error while fetching node info: ${e}. ${e.stack}`,
                });
            }
        });
    }

    updateFailedHandlerId(handlerId, error, next) {
        if (handlerId !== null) {
            Models.handler_ids.update(
                {
                    status: 'FAILED',
                    data: JSON.stringify({ errorMessage: error.message }),
                },
                {
                    where: {
                        handler_id: handlerId,
                    },
                },
            );
        } else {
            return next({
                code: 400,
                message: 'Something went wrong with the requested operation, try again.',
            });
        }
    }
}

module.exports = RpcController;
