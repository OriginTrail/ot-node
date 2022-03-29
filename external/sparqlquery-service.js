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
        if (options.prefix && !(typeof options.prefix === 'boolean')) {
            this.logger.error(`Failed FindassertionsByKeyword: ${options.prefix} is not a boolean`);
            throw new Error('Prefix is not an boolean');
        }
        if (localQuery && !(typeof localQuery === 'boolean')) {
            this.logger.error(`Failed FindassertionsByKeyword: ${localQuery} is not a boolean`);
            throw new Error('Localquery is not an boolean');
        }
        let limitQuery = '';
        query = this.cleanEscapeCharacter(query);
        limitQuery = this.createLimitQuery(options);

        const publicVisibilityQuery = !localQuery ? ' ?assertionId schema:hasVisibility "public" .' : '';
        const filterQuery = options.prefix ? `FILTER contains(lcase(?keyword),'${query}')` : `FILTER (lcase(?keyword) = '${query}')`;

        const sparqlQuery = `PREFIX schema: <http://schema.org/>
                            SELECT distinct ?assertionId
                            WHERE {
                                ?assertionId schema:hasKeywords ?keyword .
                                ${publicVisibilityQuery}
                                ${filterQuery}
                            }
                        ${limitQuery}`;

        const result = await this.execute(sparqlQuery);
        return result;
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
        const test = await this.queryEngine.queryBindings(query, {
            sources: [{
                type: 'sparql',
                value: `${this.config.url}`,
            }],
            log: this.logger,
        });
        return test.toArray();
    }

    cleanEscapeCharacter(query) {
        return query.replace(/['|[\]\\]/g, '\\$&');
    }

    createLimitQuery(options) {
        if (options.limit && !Number.isInteger(options.limit)) {
            this.logger.error(`Failed FindassertionsByKeyword: ${options.limit} is not a number`);
            throw new Error('Limit is not a number');
        } else if (Number.isInteger(options.limit) && options.limit < 0) {
            this.logger.error(`Failed FindassertionsByKeyword: ${options.limit} is negative number`);
            throw new Error('Limit is not a number');
        }
        return options.limit ? `LIMIT ${options.limit}` : '';
    }
}

module.exports = SparqlqueryService;
