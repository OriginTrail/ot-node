import axios from 'axios';
import OtTripleStore from '../ot-triple-store.js';

class OtBlazegraph extends OtTripleStore {
    async initialize(config, logger) {
        await super.initialize(config, logger);

        await Promise.all(
            Object.keys(this.repositories).map(async (repository) => {
                const { url, name } = this.repositories[repository];
                // create repository if not exists
                await axios.post(
                    `${url}/namespace`,
                    `com.bigdata.rdf.sail.truthMaintenance=false\ncom.bigdata.namespace.${name}.lex.com.bigdata.btree.BTree.branchingFactor=400\ncom.bigdata.rdf.store.AbstractTripleStore.textIndex=false\ncom.bigdata.rdf.store.AbstractTripleStore.justify=false\ncom.bigdata.namespace.${name}.spo.com.bigdata.btree.BTree.branchingFactor=1024\ncom.bigdata.rdf.store.AbstractTripleStore.statementIdentifiers=false\ncom.bigdata.rdf.store.AbstractTripleStore.axiomsClass=com.bigdata.rdf.axioms.NoAxioms\ncom.bigdata.rdf.sail.namespace=${name}\ncom.bigdata.rdf.store.AbstractTripleStore.quads=true\ncom.bigdata.rdf.store.AbstractTripleStore.geoSpatial=false\ncom.bigdata.journal.Journal.groupCommit=false\ncom.bigdata.rdf.sail.isolatableIndices=false\n`,
                    {
                        headers: {
                            'Content-Type': 'text/plain',
                        },
                    },
                );
            }),
        );
    }

    initializeSparqlEndpoints(repository) {
        const { url, name } = this.repositories[repository];
        this.repositories[repository].sparqlEndpoint = `${url}/namespace/${name}/sparql`;
        this.repositories[repository].sparqlEndpointUpdate = `${url}/namespace/${name}/sparql`;
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
