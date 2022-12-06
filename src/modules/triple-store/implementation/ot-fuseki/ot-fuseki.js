import axios from 'axios';
import OtTripleStore from '../ot-triple-store.js';

class OtFuseki extends OtTripleStore {
    initializeSparqlEndpoints(repository, config) {
        this.repositories[repository].sparqlEndpoint = `${config.url}/${repository}/sparql`;
        this.repositories[repository].sparqlEndpointUpdate = `${config.url}/${repository}/update`;
    }

    async healthCheck(repository, config) {
        try {
            const response = await axios.get(`${config.url}/$/ping`, {});
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
