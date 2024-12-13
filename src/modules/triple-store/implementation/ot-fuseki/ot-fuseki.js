import axios from 'axios';
import OtTripleStore from '../ot-triple-store.js';

class OtFuseki extends OtTripleStore {
    async initialize(config, logger) {
        await super.initialize(config, logger);
        await Promise.all(
            Object.keys(this.repositories).map(async (repository) => {
                await this.createRepository(repository);
            }),
        );
    }

    async createRepository(repository) {
        const { url, name } = this.repositories[repository];

        if (!(await this.repositoryExists(repository))) {
            await axios.post(
                `${url}/$/datasets?dbName=${name}&dbType=tdb`,
                {},
                {
                    headers: {
                        'Content-Type': 'text/plain',
                    },
                },
            );
        }
    }

    initializeSparqlEndpoints(repository) {
        const { url, name } = this.repositories[repository];
        this.repositories[repository].sparqlEndpoint = `${url}/${name}/sparql`;
        this.repositories[repository].sparqlEndpointUpdate = `${url}/${name}/update`;
    }

    async healthCheck(repository) {
        try {
            const response = await axios.get(`${this.repositories[repository].url}/$/ping`, {});
            if (response.data !== null) {
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    async deleteRepository(repository) {
        const { url, name } = this.repositories[repository];
        this.logger.info(
            `Deleting ${this.getName()} triple store repository: ${repository} with name: ${name}`,
        );

        if (await this.repositoryExists(repository)) {
            await axios
                .delete(`${url}/$/datasets/${name}`, {})
                .catch((e) =>
                    this.logger.error(
                        `Error while deleting ${this.getName()} triple store repository: ${repository} with name: ${name}. Error: ${
                            e.message
                        }`,
                    ),
                );
        }
    }

    async repositoryExists(repository) {
        const { url, name } = this.repositories[repository];
        try {
            const response = await axios.get(`${url}/$/datasets`);

            return response.data.assertions.filter(
                (assertion) => assertion['ds.name'] === `/${name}`,
            ).length;
        } catch (error) {
            this.logger.error(
                `Error while getting ${this.getName()} repositories. Error: ${error.message}`,
            );

            return false;
        }
    }

    getName() {
        return 'OtFuseki';
    }
}

export default OtFuseki;
