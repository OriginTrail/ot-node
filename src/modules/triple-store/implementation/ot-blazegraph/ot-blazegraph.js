import axios from 'axios';
import OtTripleStore from '../ot-triple-store.js';

class OtBlazegraph extends OtTripleStore {
    async initialize(config, logger) {
        await super.initialize(config, logger);

        await Promise.all(
            Object.keys(this.repositories).map(async (repository) => {
                const { url } = this.repositories[repository];
                // create repository if not exists
                await fetch(`${url}/namespace`, {
                    headers: {
                        'content-type': 'text/plain',
                    },
                    body: `com.bigdata.rdf.store.AbstractTripleStore.textIndex=false\ncom.bigdata.rdf.store.AbstractTripleStore.axiomsClass=com.bigdata.rdf.axioms.NoAxioms\ncom.bigdata.rdf.sail.isolatableIndices=false\ncom.bigdata.rdf.sail.truthMaintenance=false\ncom.bigdata.rdf.store.AbstractTripleStore.justify=false\ncom.bigdata.rdf.sail.namespace=${repository}\ncom.bigdata.rdf.store.AbstractTripleStore.quads=false\ncom.bigdata.journal.Journal.groupCommit=false\ncom.bigdata.namespace.djordjeTest1.spo.com.bigdata.btree.BTree.branchingFactor=1024\ncom.bigdata.rdf.store.AbstractTripleStore.geoSpatial=false\ncom.bigdata.namespace.djordjeTest1.lex.com.bigdata.btree.BTree.branchingFactor=400\ncom.bigdata.rdf.store.AbstractTripleStore.statementIdentifiers=false\n`,
                    method: 'POST',
                });
            }),
        );
    }

    initializeSparqlEndpoints(repository) {
        const { url } = this.repositories[repository];
        this.repositories[repository].sparqlEndpoint = `${url}/namespace/${repository}/sparql`;
        this.repositories[
            repository
        ].sparqlEndpointUpdate = `${url}/namespace/${repository}/sparql`;
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
