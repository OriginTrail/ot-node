import axios from 'axios';
import OtTripleStore from '../ot-triple-store.js';

class OtFuseki extends OtTripleStore {
    async initialize(config, logger) {
        await super.initialize(config, logger);
        await Promise.all(
            Object.keys(this.repositories).map(async (repository) => {
                const { url, name } = this.repositories[repository];

                const datasets = await axios.get(`${url}$/datasets`);
                let exists = false;
                for (const dataset of datasets.data.datasets) {
                    if (dataset['ds.name'] === `/${name}`) {
                        exists = true;
                        break;
                    }
                }
                if (!exists) {
                    await axios.post(
                        `${url}$/datasets?dbName=${name}&dbType=tdb`,
                        {},
                        {
                            headers: {
                                'Content-Type': 'text/plain',
                            },
                        },
                    );
                }
            }),
        );
    }

    initializeSparqlEndpoints(repository) {
        const { url, name } = this.repositories[repository];
        this.repositories[repository].sparqlEndpoint = `${url}/${name}/sparql`;
        this.repositories[repository].sparqlEndpointUpdate = `${url}/${name}/update`;
    }

    async healthCheck(repository) {
        try {
            const response = await axios.get(`${this.repositories[repository].url}$/ping`, {});
            if (response.data !== null) {
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    getName() {
        return 'OtFuseki';
    }
}

export default OtFuseki;
