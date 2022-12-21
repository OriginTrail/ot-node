import { QueryEngine as Engine } from '@comunica/query-sparql';
import { setTimeout } from 'timers/promises';
import {
    SCHEMA_CONTEXT,
    TRIPLE_STORE_CONNECT_MAX_RETRIES,
    TRIPLE_STORE_CONNECT_RETRY_FREQUENCY,
    MEDIA_TYPES,
} from '../../../constants/constants.js';

class OtTripleStore {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;
        this.initializeRepositories();
        this.initializeContexts();
        await this.ensureConnections();
        this.queryEngine = new Engine();
    }

    initializeRepositories() {
        this.repositories = {};
        for (const [repository, config] of Object.entries(this.config.repositories)) {
            this.repositories[repository] = {};
            this.initializeSparqlEndpoints(repository, config);
        }
    }

    initializeSparqlEndpoints() {
        throw Error('initializeSparqlEndpoints not implemented');
    }

    initializeContexts() {
        for (const repository of Object.keys(this.config.repositories)) {
            const sources = [
                {
                    type: 'sparql',
                    value: this.repositories[repository].sparqlEndpoint,
                },
            ];

            this.repositories[repository].insertContext = {
                sources,
                destination: {
                    type: 'sparql',
                    value: this.repositories[repository].sparqlEndpointUpdate,
                },
            };
            this.repositories[repository].queryContext = {
                sources,
            };
        }
    }

    async ensureConnections() {
        const ensureConnectionPromises = Object.entries(this.config.repositories).map(
            async ([repository, config]) => {
                let ready = await this.healthCheck(repository, config);
                let retries = 0;
                while (!ready && retries < TRIPLE_STORE_CONNECT_MAX_RETRIES) {
                    retries += 1;
                    this.logger.warn(
                        `Cannot connect to Triple store (${this.getName()}), repository: ${repository}, located at: ${
                            this.config.repositories[repository].url
                        }  retry number: ${retries}/${TRIPLE_STORE_CONNECT_MAX_RETRIES}. Retrying in ${TRIPLE_STORE_CONNECT_RETRY_FREQUENCY} seconds.`,
                    );
                    /* eslint-disable no-await-in-loop */
                    await setTimeout(TRIPLE_STORE_CONNECT_RETRY_FREQUENCY * 1000);
                    ready = await this.healthCheck(repository, config);
                }
                if (retries === TRIPLE_STORE_CONNECT_MAX_RETRIES) {
                    this.logger.error(
                        `Triple Store (${this.getName()})  not available, max retries reached.`,
                    );
                    process.exit(1);
                }
            },
        );

        await Promise.all(ensureConnectionPromises);
    }

    async assetExists(repository, ual, blockchain, contract, tokenId) {
        const query = `PREFIX schema: <${SCHEMA_CONTEXT}>
                        ASK WHERE {
                            GRAPH <assets:graph> {
                                <${ual}> schema:blockchain "${blockchain}";
                                         schema:contract   "${contract}";
                                         schema:tokenId    ${tokenId};
                            }
                        }`;

        return this.ask(repository, query);
    }

    async isAssertionIdShared(repository, assertionId) {
        const query = `PREFIX schema: <${SCHEMA_CONTEXT}>
                    SELECT (COUNT(DISTINCT ?ual) as ?count)
                    WHERE {
                        GRAPH <assets:graph> {
                                ?ual schema:assertion <assertion:${assertionId}>
                        }
                    }`;
        const count = await this.select(repository, query);
        return count > 1;
    }

    async getAssetAssertionIds(repository, ual) {
        const query = `PREFIX schema: <${SCHEMA_CONTEXT}>
                    SELECT DISTINCT ?assertionId
                    WHERE {
                        GRAPH <assets:graph> {
                                <${ual}> schema:assertion ?assertionId .
                        }
                    }`;
        const result = await this.select(repository, query);
        console.log('assertion ids ', result);
        return result;
    }

    async assetAgreementExists(repository, ual, blockchain, contract, tokenId) {
        const query = `PREFIX schema: <${SCHEMA_CONTEXT}>
                        ASK WHERE {
                            GRAPH <assets:graph> {
                                <${ual}> schema:blockchain "${blockchain}";
                                         schema:contract   "${contract}";
                                         schema:tokenId    ${tokenId};
                                         schema:assertion ?assertion;
                                         schema:agreementStartTime ?agreementStartTime;
                                         schema:agreementEndTime ?agreementEndTime;
                                         schema:keyword ?keyword;
                            }
                        }`;

        return this.ask(repository, query);
    }

    async insertAsset(repository, ual, assetNquads, deleteAssetTriples = true) {
        const deleteAssetTriplesQuery = `DELETE {
                <${ual}> schema:assertion ?assertion . 
                <${ual}> schema:agreementEndTime ?agreementEndTime
            }
            WHERE {
                GRAPH <assets:graph> {
                    ?s ?p ?o .
                    <${ual}> schema:agreementEndTime ?agreementEndTime .
                    <${ual}> schema:assertion ?assertion .
                }
            };`;
        const insertion = `
            PREFIX schema: <${SCHEMA_CONTEXT}>
            ${deleteAssetTriples ? deleteAssetTriplesQuery : ''}
            INSERT DATA {
                GRAPH <assets:graph> { 
                    ${assetNquads} 
                }
            }`;
        await this.queryEngine.queryVoid(insertion, this.repositories[repository].insertContext);
    }

    async insertAssertion(repository, assertionId, assertionNquads) {
        const exists = await this.assertionExists(repository, assertionId);

        if (!exists) {
            const insertion = `
            PREFIX schema: <${SCHEMA_CONTEXT}>
            INSERT DATA {
                GRAPH <assertion:${assertionId}> { 
                    ${assertionNquads} 
                } 
            }`;
            await this.queryEngine.queryVoid(
                insertion,
                this.repositories[repository].insertContext,
            );
        }
    }

    async construct(repository, query) {
        return this._executeQuery(repository, query, MEDIA_TYPES.N_QUADS);
    }

    async select(repository, query) {
        // todo: add media type once bug is fixed
        // no media type is passed because of comunica bug
        // https://github.com/comunica/comunica/issues/1034
        const result = await this._executeQuery(query);
        return result ? JSON.parse(result) : [];
    }

    async ask(repository, query) {
        return this.queryEngine.queryBoolean(query, this.repositories[repository].queryContext);
    }

    async assertionExists(repository, assertionId) {
        const escapedAssertionId = this.cleanEscapeCharacter(assertionId);
        const query = `ASK WHERE { GRAPH <assertion:${escapedAssertionId}> { ?s ?p ?o } }`;

        return this.ask(repository, query);
    }

    async deleteAssertion(repository, assertionId) {
        const query = `DROP GRAPH <assertion:${assertionId}>`;

        await this.queryEngine.queryVoid(query, this.repositories[repository].insertContext);
    }

    async getAssertion(repository, graphName) {
        const escapedGraphName = this.cleanEscapeCharacter(graphName);

        const query = `PREFIX schema: <${SCHEMA_CONTEXT}>
                    CONSTRUCT { ?s ?p ?o }
                    WHERE {
                        {
                            GRAPH <assertion:${escapedGraphName}>
                            {
                                ?s ?p ?o .
                            }
                        }
                    }`;
        return this.construct(repository, query);
    }

    async healthCheck() {
        return true;
    }

    async _executeQuery(repository, query, mediaType) {
        const result = await this.queryEngine.query(
            query,
            this.repositories[repository].queryContext,
        );
        const { data } = await this.queryEngine.resultToString(result, mediaType);

        let response = '';

        for await (const chunk of data) {
            response += chunk;
        }

        return response;
    }

    cleanEscapeCharacter(query) {
        return query.replace(/['|[\]\\]/g, '\\$&');
    }

    createLimitQuery(options) {
        if (!options.limit) {
            return '';
        }
        const queryLimit = Number(options.limit);
        if (Number.isNaN(queryLimit) || !Number.isInteger(queryLimit)) {
            this.logger.error(`Failed creating Limit query: ${options.limit} is not a number`);
            throw new Error('Limit is not a number');
        } else if (Number.isInteger(options.limit) && options.limit < 0) {
            this.logger.error(`Failed creating Limit query: ${options.limit} is negative number`);
            throw new Error('Limit is not a number');
        }
        return `LIMIT ${queryLimit}`;
    }

    isBoolean(param) {
        return typeof param === 'boolean' || ['true', 'false'].includes(param);
    }

    async reinitialize() {
        const ready = await this.healthCheck();
        if (!ready) {
            this.logger.warn(
                `Cannot connect to Triple store (${this.getName()}), check if your triple store is running.`,
            );
        } else {
            this.implementation.initialize(this.logger);
        }
    }
}

export default OtTripleStore;
