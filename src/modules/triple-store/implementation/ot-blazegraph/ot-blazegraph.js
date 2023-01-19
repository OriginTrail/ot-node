import axios from 'axios';
import jsonld from 'jsonld';
import OtTripleStore from '../ot-triple-store.js';

class OtBlazegraph extends OtTripleStore {
    async initialize(config, logger) {
        await super.initialize(config, logger);

        await Promise.all(
            Object.keys(this.repositories).map(async (repository) => {
                const { url, name } = this.repositories[repository];

                if (!(await this.repositoryExists(repository))) {
                    await axios.post(
                        `${url}/blazegraph/namespace`,
                        `com.bigdata.rdf.sail.truthMaintenance=false\ncom.bigdata.namespace.${name}.lex.com.bigdata.btree.BTree.branchingFactor=400\ncom.bigdata.rdf.store.AbstractTripleStore.textIndex=false\ncom.bigdata.rdf.store.AbstractTripleStore.justify=false\ncom.bigdata.namespace.${name}.spo.com.bigdata.btree.BTree.branchingFactor=1024\ncom.bigdata.rdf.store.AbstractTripleStore.statementIdentifiers=false\ncom.bigdata.rdf.store.AbstractTripleStore.axiomsClass=com.bigdata.rdf.axioms.NoAxioms\ncom.bigdata.rdf.sail.namespace=${name}\ncom.bigdata.rdf.store.AbstractTripleStore.quads=true\ncom.bigdata.rdf.store.AbstractTripleStore.geoSpatial=false\ncom.bigdata.journal.Journal.groupCommit=false\ncom.bigdata.rdf.sail.isolatableIndices=false\n`,
                        {
                            headers: {
                                'Content-Type': 'text/plain',
                            },
                        },
                    );
                }
            }),
        );
    }

    initializeSparqlEndpoints(repository) {
        const { url, name } = this.repositories[repository];
        this.repositories[repository].sparqlEndpoint = `${url}/blazegraph/namespace/${name}/sparql`;
        this.repositories[
            repository
        ].sparqlEndpointUpdate = `${url}/blazegraph/namespace/${name}/sparql`;
    }

    async healthCheck(repository) {
        try {
            const response = await axios.get(
                `${this.repositories[repository].url}/blazegraph/status`,
                {},
            );
            if (response.data !== null) {
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    async deleteRepository(repository) {
        const { url, name } = this.repositories[repository];
        this.logger.info(
            `Deleting ${this.getName()} triple store repository: ${repository} with name: ${name}`,
        );

        if (await this.repositoryExists(repository)) {
            await axios
                .delete(`${url}/blazegraph/namespace/${name}`, {})
                .catch((e) =>
                    this.logger.error(
                        `Error while deleting ${this.getName()} triple store repository: ${repository} with name: ${name}. Error: ${
                            e.message
                        }`,
                    ),
                );
        }
    }

    async repositoryExists(repository) {
        const { url, name } = this.repositories[repository];

        try {
            const { data: jsonldNamespaces } = await axios.get(`${url}/blazegraph/namespace`, {
                params: {
                    'describe-each-named-graph': 'false',
                },
                headers: {
                    Accept: 'application/ld+json',
                },
            });

            const compactedNamespaces = await jsonld.frame(jsonldNamespaces, {});

            return compactedNamespaces['@graph'].filter(
                (namespace) =>
                    namespace['http://www.bigdata.com/rdf#/features/KB/Namespace'] === name,
            ).length;
        } catch (error) {
            this.logger.error(
                `Error while getting ${this.getName()} repositories. Error: ${error.message}`,
            );

            return false;
        }
    }

    getName() {
        return 'OtBlazegraph';
    }
}

export default OtBlazegraph;
