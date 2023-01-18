import axios from 'axios';
import OtTripleStore from '../ot-triple-store.js';

class OtFuseki extends OtTripleStore {
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

    getName() {
        return 'OtFuseki';
    }
}

export default OtFuseki;
