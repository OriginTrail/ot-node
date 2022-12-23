import axios from 'axios';
import OtTripleStore from '../ot-triple-store.js';

class OtBlazegraph extends OtTripleStore {
    initializeSparqlEndpoints(repository) {
        const { url } = this.repositories[repository];
        this.repositories[repository].sparqlEndpoint = `${url}/sparql`;
        this.repositories[repository].sparqlEndpointUpdate = `${url}/sparql`;
    }

    async healthCheck(repository) {
        try {
            const response = await axios.get(`${this.repositories[repository].url}/status`, {});
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
