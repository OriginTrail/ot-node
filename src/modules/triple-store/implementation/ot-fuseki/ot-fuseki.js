/* eslint-disable import/extensions */
import axios from 'axios';
import OtTripleStore from '../ot-triple-store.js';

class OtFuseki extends OtTripleStore {
    initializeSparqlEndpoints(url, repository) {
        this.sparqlEndpoint = `${url}/${repository}/sparql`;
        this.sparqlEndpointUpdate = `${url}/${repository}/update`;
    }

    async healthCheck() {
        try {
            const response = await axios.get(`${this.config.url}/$/ping`, {});
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
