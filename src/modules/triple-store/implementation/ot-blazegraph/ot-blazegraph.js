/* eslint-disable import/extensions */
import axios from 'axios';
import OtTripleStore from '../ot-triple-store.js';

class OtBlazegraph extends OtTripleStore {
    initializeSparqlEndpoints(url) {
        this.sparqlEndpoint = `${url}/sparql`;
        this.sparqlEndpointUpdate = `${url}/sparql`;
    }

    async healthCheck() {
        try {
            const response = await axios.get(`${this.config.url}/status`, {});
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
