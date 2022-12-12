import graphdb from 'graphdb';
import axios from 'axios';
import OtTripleStore from '../ot-triple-store.js';

const { server, repository, http } = graphdb;

class OtGraphdb extends OtTripleStore {
    async initialize(config, logger) {
        await super.initialize(config, logger);
        const serverConfig = new server.ServerClientConfig(this.config.url)
            .setTimeout(40000)
            .setHeaders({
                Accept: http.RDFMimeType.N_QUADS,
            })
            .setKeepAlive(true);
        const s = new server.GraphDBServerClient(serverConfig);

        const exists = await s.hasRepository(this.config.repository);
        if (!exists) {
            try {
                await s.createRepository(
                    new repository.RepositoryConfig(
                        this.config.repository,
                        '',
                        new Map(),
                        '',
                        'Repo title',
                        repository.RepositoryType.FREE,
                    ),
                );
            } catch (e) {
                await s.createRepository(
                    new repository.RepositoryConfig(
                        this.config.repository,
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

    initializeSparqlEndpoints(url, repo) {
        this.sparqlEndpoint = `${url}/repositories/${repo}`;
        this.sparqlEndpointUpdate = `${url}/repositories/${repo}/statements`;
    }

    async healthCheck() {
        try {
            const response = await axios.get(
                `${this.config.url}/repositories/${this.config.repository}/health`,
                {},
                {
                    auth: {
                        username: this.config.username,
                        password: this.config.password,
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
