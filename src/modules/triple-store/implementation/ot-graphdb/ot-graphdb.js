import graphdb from 'graphdb';
import axios from 'axios';
import OtTripleStore from '../ot-triple-store.js';

const { server, repository: repo, http } = graphdb;

class OtGraphdb extends OtTripleStore {
    async initialize(config, logger) {
        await super.initialize(config, logger);

        for (const repository of Object.keys(this.config.repositories)) {
            const serverConfig = new server.ServerClientConfig(
                this.config.repositories[repository].url,
            )
                .setTimeout(40000)
                .setHeaders({
                    Accept: http.RDFMimeType.N_QUADS,
                })
                .setKeepAlive(true);
            const s = new server.GraphDBServerClient(serverConfig);
            // eslint-disable-next-line no-await-in-loop
            const exists = await s.hasRepository(this.config.repositories[repository].name);
            if (!exists) {
                try {
                    // eslint-disable-next-line no-await-in-loop
                    await s.createRepository(
                        new repo.RepositoryConfig(
                            this.config.repositories[repository].name,
                            '',
                            new Map(),
                            '',
                            'Repo title',
                            repo.RepositoryType.FREE,
                        ),
                    );
                } catch (e) {
                    // eslint-disable-next-line no-await-in-loop
                    await s.createRepository(
                        new repo.RepositoryConfig(
                            this.config.repositories[repository].name,
                            '',
                            {},
                            'graphdb:SailRepository',
                            'Repo title',
                            'graphdb',
                        ),
                    );
                }
            }
        }
    }

    initializeSparqlEndpoints(repository, config) {
        this.repositories[repository].sparqlEndpoint = `${config.url}/repositories/${config.name}`;
        this.repositories[
            repository
        ].sparqlEndpointUpdate = `${config.url}/repositories/${config.name}/statements`;
    }

    async healthCheck(repository, config) {
        try {
            const response = await axios.get(
                `${config.url}/repositories/${repository}/health`,
                {},
                {
                    auth: {
                        username: config.username,
                        password: config.password,
                    },
                },
            );
            if (response.data.status === 'green') {
                return true;
            }
            return false;
        } catch (e) {
            if (e.response && e.response.status === 404) {
                // Expected error: GraphDB is up but has not created node0 repository
                // Ot-node will create repo in initialization
                return true;
            }
            return false;
        }
    }

    getName() {
        return 'GraphDB';
    }
}

export default OtGraphdb;
