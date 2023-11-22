import BaseMigration from './base-migration.js';
import { CHAIN_IDS } from '../constants/constants.js';

const chainId = CHAIN_IDS[process.env.NODE_ENV];

class UalExtensionTripleStoreMigration extends BaseMigration {
    constructor(migrationName, logger, config, tripleStoreService) {
        super(migrationName, logger, config);
        this.tripleStoreService = tripleStoreService;
    }

    async executeMigration() {
        const oldBlockchainId = this.getOldBlockchainId();
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
                      FILTER (STRSTARTS(STR(?s), "did:dkg:${oldBlockchainId}/"))
                      BIND (IRI(REPLACE(STR(?s), "${oldBlockchainId}", "${newBlockchainId}")) AS ?newSubject)
                    }
        `;

        await this.tripleStoreService.queryVoidAllRepositories(updateSubjectQuery);

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

        await this.tripleStoreService.queryVoidAllRepositories(updateObjectQuery);
    }

    getOldBlockchainId() {
        let oldBlockchainId;
        if (this.config.modules.blockchain.implementation) {
            for (const implementationName in this.config.modules.blockchain.implementation) {
                if (this.config.modules.blockchain.implementation[implementationName].enabled) {
                    oldBlockchainId = implementationName;
                }
            }
        }
        if (!oldBlockchainId) {
            throw Error('Unable to find old blockchain id in configuration');
        }
        return oldBlockchainId.split(':')[0];
    }
}

export default UalExtensionTripleStoreMigration;
