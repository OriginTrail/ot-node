const axios = require('axios');
const Engine = require('@comunica/query-sparql').QueryEngine;

class SparqlqueryService {
    constructor(config) {
        this.config = config;
    }

    async initialize(logger) {
        this.logger = logger;
        this.logger.info('Sparql Query module initialized successfully');
        this.queryEngine = new Engine();
    }

    async insert(triples, rootHash) {
        this.logger.info('dummy for ESLint');
    }

    async construct(query) {
        this.logger.info('dummy for ESLint');
    }

    async ask(query) {
        this.logger.info('dummy for ESLint');
    }

    async resolve(uri) {
        this.logger.info('dummy for ESLint');
    }

    async transformBlankNodes(nquads) {
        this.logger.info('dummy for ESLint');
    }

    async assertionsByAsset(uri) {
        this.logger.info('dummy for ESLint');
    }

    async findAssertions(nquads) {
        this.logger.info('dummy for ESLint');
    }

    async findAssertionsByKeyword(query, options, localQuery) {
        this.logger.info('dummy for ESLint');
    }

    async findAssetsByKeyword(query, options, localQuery) {
        this.logger.info('dummy for ESLint');
    }

    async healthCheck() {
        try {
            const response = await axios.head(`${this.config.url}`, {});
            return response.data !== null;
        } catch (e) {
            return false;
        }
    }

    async execute(query) {
        this.logger.info('dummy for ESLint');
    }

    queryCleanup(query) {
        this.logger.info('dummy for ESLint');
    }
}

module.exports = SparqlqueryService;
