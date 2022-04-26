const axios = require('axios');
const { execSync } = require('child_process');
const SparqlqueryService = require('./sparqlquery-service');

class GraphdbService extends SparqlqueryService{
    constructor(config) {
        super({
            sparqlEndpoint: `${config.url}/repositories/${config.name}`,
            sparqlEndpointUpdate: `${config.url}/repositories/${config.name}/statements`,
        })
        this.url = config.url;
        this.name = config.name;
    }

    async healthCheck() {
        try {
            const response = await axios.get(`${this.url}/repositories/${this.name}/health`, {},
                {
                    auth: {
                        username: this.config.username,
                        password: this.config.password,
                    },
                });
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

    async restartService() {
        // TODO: check env if development or production
        const port = execSync('ps -aux | grep graphdb | cut -d\' \' -f7 | head -n 1').toString();
        if (port) {
            execSync(`kill -9 ${port}`);
        }
        execSync('nohup ../graphdb-free-9.9.0/bin/graphdb &');
    }

    getName() {
        return 'GraphDB';
    }
}

module.exports = GraphdbService;
