import axios from 'axios';
import OtTripleStore from '../ot-triple-store.js';

class OtBlazegraph extends OtTripleStore {
    initializeSparqlEndpoints(repository, config) {
        this.repositories[repository].sparqlEndpoint = `${config.url}/sparql`;
        this.repositories[repository].sparqlEndpointUpdate = `${config.url}/sparql`;
    }

    async healthCheck(repository, config) {
        try {
            const response = await axios.get(`${config.url}/status`, {});
            if (response.data !== null) {
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    getName() {
        return 'OtBlazegraph';
    }
}

export default OtBlazegraph;
