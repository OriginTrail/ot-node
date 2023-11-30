import BaseMigration from './base-migration.js';
import { TRIPLE_STORE_REPOSITORIES } from '../constants/constants.js';

const CHAIN_IDS = {
    development: 31337,
    test: 31337,
    devnet: 2160,
    testnet: 20430,
    mainnet: 2043,
};
const chainId = CHAIN_IDS[process.env.NODE_ENV];

class UalExtensionTripleStoreMigration extends BaseMigration {
    constructor(migrationName, logger, config, tripleStoreService) {
        super(migrationName, logger, config);
        this.tripleStoreService = tripleStoreService;
    }

    async executeMigration() {
        const oldBlockchainId = this.getOldBlockchainId();
        const newBlockchainId = `${oldBlockchainId}:${chainId}`;

        const chunkSize = 5000;

        const totalSubjectsQuery = `
          SELECT (COUNT(*) AS ?totalObjects)
          WHERE {
            GRAPH <assets:graph> {
              ?s ?p ?o .
              FILTER (STRSTARTS(STR(?s), "did:dkg:${oldBlockchainId}/"))
            }
          }`;
        const updateSubjectQuery = `
        WITH <assets:graph>
            DELETE {
              ?s ?p ?o
            }
            INSERT {
              ?newSubject ?p ?o
            }
            WHERE {
              {
                SELECT ?s ?p ?o (IRI(REPLACE(STR(?s), "${oldBlockchainId}", "${newBlockchainId}")) AS ?newSubject)
                WHERE {
                  ?s ?p ?o .
                  FILTER (STRSTARTS(STR(?s), "did:dkg:${oldBlockchainId}/"))
                }
                LIMIT ${chunkSize}
              }
            }
          `;
        const updateObjectQuery = `
        WITH <assets:graph>
        DELETE {
          ?s ?p ?o
        }
        INSERT {
          ?s ?p "${newBlockchainId}" .
        }
        WHERE {
          SELECT ?s ?p ?o
          WHERE {
            ?s ?p ?o .
            FILTER(STRENDS(STR(?p), "blockchain"))
          }
          LIMIT ${chunkSize}
        }
          `;
        for (const repository in TRIPLE_STORE_REPOSITORIES) {
            // eslint-disable-next-line no-await-in-loop
            const totalSubjectsResult = await this.tripleStoreService.select(
                TRIPLE_STORE_REPOSITORIES[repository],
                totalSubjectsQuery,
            );
            const totalSubjects = parseInt(
                totalSubjectsResult[0].totalObjects.match(
                    /"(\d+)"\^\^http:\/\/www.w3.org\/2001\/XMLSchema#integer/,
                )[1],
                10,
            );
            let offset = 0;
            if (totalSubjects !== 0) {
                do {
                    // eslint-disable-next-line no-await-in-loop
                    await this.tripleStoreService.queryVoid(
                        TRIPLE_STORE_REPOSITORIES[repository],
                        updateSubjectQuery,
                    );

                    // eslint-disable-next-line no-await-in-loop
                    await this.tripleStoreService.queryVoid(
                        TRIPLE_STORE_REPOSITORIES[repository],
                        updateObjectQuery,
                    );

                    offset += chunkSize;
                } while (offset < totalSubjects);
            }
        }
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
