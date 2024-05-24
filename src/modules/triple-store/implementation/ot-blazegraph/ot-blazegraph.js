import axios from 'axios';
import OtTripleStore from '../ot-triple-store.js';

class OtBlazegraph extends OtTripleStore {
    async initialize(config, logger) {
        await super.initialize(config, logger);
        // this regex will match \Uxxxxxxxx but will exclude cases where there is a double slash before U (\\U)
        this.unicodeRegex = /(?<!\\)\\U([a-fA-F0-9]{8})/g;

        await Promise.all(
            Object.keys(this.repositories).map(async (repository) => {
                await this.createRepository(repository);
            }),
        );
    }

    async createRepository(repository) {
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
    }

    initializeSparqlEndpoints(repository) {
        const { url, name } = this.repositories[repository];
        this.repositories[repository].sparqlEndpoint = `${url}/blazegraph/namespace/${name}/sparql`;
        this.repositories[
            repository
        ].sparqlEndpointUpdate = `${url}/blazegraph/namespace/${name}/sparql`;
    }

    async insertAssertion(repository, assertionId, assertionNquads) {
        const exists = await this.assertionExists(repository, assertionId);

        if (!exists) {
            return axios({
                method: 'post',
                url: `${this.repositories[repository].sparqlEndpointUpdate}?context-uri=assertion:${assertionId}`,
                headers: {
                    'Content-Type': 'text/x-nquads',
                },
                data: assertionNquads,
            });
        }
    }

    hasUnicodeCodePoints(input) {
        return this.unicodeRegex.test(input);
    }

    decodeUnicodeCodePoints(input) {
        const decodedString = input.replace(this.unicodeRegex, (match, hex) => {
            const codePoint = parseInt(hex, 16);
            return String.fromCodePoint(codePoint);
        });

        return decodedString;
    }

    async _executeQuery(repository, query, mediaType) {
        const result = await this.queryEngine.query(
            query,
            this.repositories[repository].queryContext,
        );
        const { data } = await this.queryEngine.resultToString(result, mediaType);

        let response = '';

        for await (const chunk of data) {
            response += chunk;
        }

        // Handle Blazegraph special characters corruption
        if (this.hasUnicodeCodePoints(response)) {
            response = this.decodeUnicodeCodePoints(response);
        }

        return response;
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
            await axios.get(`${url}/blazegraph/namespace/${name}/properties`, {
                params: {
                    'describe-each-named-graph': 'false',
                },
                headers: {
                    Accept: 'application/ld+json',
                },
            });
            return true;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                // Expected error: GraphDB is up but has not created node0 repository
                // Ot-node will create repo in initialization
                return false;
            }
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
