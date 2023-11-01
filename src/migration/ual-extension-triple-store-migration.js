import BaseMigration from './base-migration.js';
import { NODE_ENVIRONMENTS, TRIPLE_STORE_REPOSITORIES } from '../constants/constants.js';

const chainIds = {
    [NODE_ENVIRONMENTS.TESTNET]: 20430,
    [NODE_ENVIRONMENTS.MAINNET]: 2043,
    [NODE_ENVIRONMENTS.DEVELOPMENT]: 2160,
};
const chainId = chainIds[process.env.NODE_ENV];

class UalExtensionTripleStoreMigration extends BaseMigration {
    constructor(migrationName, logger, config, tripleStoreService) {
        super(migrationName, logger, config);
        this.tripleStoreService = tripleStoreService;
    }

    async executeMigration() {
        const oldBlockchainId = 'did:dkg:otp';
        const newBlockchainId = `${oldBlockchainId}:${chainId}`;

        const updateSubjectQuery = `
                    WITH <assets:graph>
                    DELETE {
                      ?s ?p ?o
                    }
                    INSERT {
                      ?newSubject ?p ?o
                    }
                    WHERE {
                      ?s ?p ?o .
                      FILTER (STRSTARTS(STR(?s), "${oldBlockchainId}"))
                      BIND (IRI(REPLACE(STR(?s), "${oldBlockchainId}", "${newBlockchainId}")) AS ?newSubject)
                    }
        `;

        await this.tripleStoreService.queryVoidAllRepositories(
            TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
            updateSubjectQuery,
        );

        const updateObjectQuery = `
        WITH <assets:graph>
            DELETE {
              ?s ?p ?o
            }
            INSERT {
              ?s ?p ?newObject
            }
            WHERE {
              ?s ?p ?o .
              FILTER(STRENDS(STR(?p), "blockchain"))
              BIND ("${newBlockchainId}" AS ?newObject)
            } 
        `;

        await this.tripleStoreService.queryVoidAllRepositories(
            TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
            updateObjectQuery,
        );
    }
}

export default UalExtensionTripleStoreMigration;
