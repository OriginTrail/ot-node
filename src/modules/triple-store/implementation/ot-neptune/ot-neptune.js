import axios from 'axios';
import https from 'https';
import OtTripleStore from '../ot-triple-store.js';

class OTNeptune extends OtTripleStore {
    async initialize(config, logger) {
        await super.initialize(config, logger);
    }

    initializeSparqlEndpoints(repository) {
        const { url } = this.repositories[repository];
        this.repositories[repository].sparqlEndpoint = `${url}/sparql`;
        this.repositories[repository].sparqlEndpointUpdate = `${url}/sparql`;
    }

    async insertAssertion(repository, assertionId, assertionNquads) {
        const { url } = this.repositories[repository];
        const exists = await this.assertionExists(repository, assertionId);

        const httpsAgent = new https.Agent({
            rejectUnauthorized: false, // Accept self-signed certificates
        });

        if (!exists) {
            const response = await axios.post(`${url}/sparql`, `INSERT DATA {${assertionNquads}}`, {
                headers: {
                    'Content-Type': 'application/sparql-update',
                },
                httpsAgent,
            });

            return response.data;
        }
    }

    async _executeQuery(repository, query) {
        const { url } = this.repositories[repository];

        const httpsAgent = new https.Agent({
            rejectUnauthorized: false, // Accept self-signed certificates
        });

        const response = await axios.post(`${url}/sparql`, `query=${encodeURIComponent(query)}`, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            httpsAgent,
            responseType: 'text',
        });

        return response.data;
    }

    async select(repository, query) {
        const result = await super.select(repository, query);

        return result.results.bindings;
    }

    async healthCheck(repository) {
        const { url } = this.repositories[repository];

        const response = await axios.get(`${url}/status`);

        if (response.status === 200) {
            return true;
        }

        return false;
    }

    getName() {
        return 'OtNeptune';
    }

    async deleteRepository() {
        // empty
    }

    async createRepository() {
        // empty
    }
}

export default OTNeptune;
