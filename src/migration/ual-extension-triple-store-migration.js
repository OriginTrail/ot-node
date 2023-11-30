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

        const chunkSize = 10000;

        const totalSubjectsQuery = `
          SELECT (COUNT(*) AS ?totalObjects)
          WHERE {
            GRAPH <assets:graph> {
              ?s ?p ?o .
              FILTER (STRSTARTS(STR(?s), "did:dkg:${oldBlockchainId}/"))
            }
          }`;

        const totalObjectsQuery = `
        SELECT (COUNT(*) AS ?totalObjects)
        WHERE {
          ?s ?p ?o .
          FILTER(STRENDS(STR(?p), "blockchain") && STRENDS(STR(?o), "${oldBlockchainId}"))
        }
        
        `;
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
            FILTER(STRENDS(STR(?p), "blockchain") && STRENDS(STR(?o), "${oldBlockchainId}"))
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
            this.logger.debug(
                `Total number of triple store subjects that will be updated: ${totalSubjects} in repositroy: ${repository}.`,
            );
            let offsetSubject = 0;
            if (totalSubjects !== 0) {
                do {
                    // eslint-disable-next-line no-await-in-loop
                    await this.tripleStoreService.queryVoid(
                        TRIPLE_STORE_REPOSITORIES[repository],
                        updateSubjectQuery,
                    );

                    offsetSubject += chunkSize;
                    this.logger.debug(
                        `Number of subjects updated: ${offsetSubject} in repository ${repository}`,
                    );
                } while (offsetSubject < totalSubjects);
                this.logger.debug(
                    `Finalised triple store subject update in repository: ${repository}.`,
                );
            }
            // eslint-disable-next-line no-await-in-loop
            const totalObjectsResult = await this.tripleStoreService.select(
                TRIPLE_STORE_REPOSITORIES[repository],
                totalObjectsQuery,
            );
            const totalObjects = parseInt(
                totalObjectsResult[0].totalObjects.match(
                    /"(\d+)"\^\^http:\/\/www.w3.org\/2001\/XMLSchema#integer/,
                )[1],
                10,
            );
            let offsetObject = 0;
            this.logger.debug(
                `Total number of triple store object that will be updated: ${totalObjects} in repositroy: ${repository}.`,
            );
            if (totalObjects !== 0) {
                do {
                    // eslint-disable-next-line no-await-in-loop
                    await this.tripleStoreService.queryVoid(
                        TRIPLE_STORE_REPOSITORIES[repository],
                        updateObjectQuery,
                    );

                    offsetObject += chunkSize;
                    this.logger.debug(
                        `Number of objects updated: ${offsetObject} in repository ${repository}`,
                    );
                } while (offsetObject < totalObjects);
                this.logger.debug(
                    `Finalised triple store object update in repository: ${repository}.`,
                );
            }
        }
        // for (const repository in TRIPLE_STORE_REPOSITORIES) {
        //     const countOldSujbectQuerry = `SELECT (COUNT(*) AS ?count)
        //                         WHERE {
        //                         ?s ?p ?o .
        //                         FILTER (STRSTARTS(STR(?s), "did:dkg:otp/"))
        //                         }`;
        //     // eslint-disable-next-line no-await-in-loop
        //     const countOldSujbectResult = await this.tripleStoreModuleManager.select(
        //         this.repositoryImplementations[repository],
        //         TRIPLE_STORE_REPOSITORIES[repository],
        //         countOldSujbectQuerry,
        //     );
        //     const countNewSujbectQuerry = `SELECT (COUNT(*) AS ?count)
        //                                   WHERE {
        //                                     ?s ?p ?o .
        //                                     FILTER (STRSTARTS(STR(?s), "did:dkg:otp:2160/"))
        //                                   }`;
        //     // eslint-disable-next-line no-await-in-loop
        //     const countNewSujbectQuerryResult = await this.tripleStoreModuleManager.select(
        //         this.repositoryImplementations[repository],
        //         TRIPLE_STORE_REPOSITORIES[repository],
        //         countNewSujbectQuerry,
        //     );
        //
        //     const countOldObjectsQuery = `SELECT (COUNT(*) AS ?count)
        //                                   WHERE {
        //                                     ?s ?p ?o .
        //                                     FILTER(STRENDS(STR(?p), "blockchain") && STRENDS(STR(?o), "otp"))
        //                                   }`;
        //     // eslint-disable-next-line no-await-in-loop
        //     const countOldObjectsQueryResult = await this.tripleStoreModuleManager.select(
        //         this.repositoryImplementations[repository],
        //         TRIPLE_STORE_REPOSITORIES[repository],
        //         countOldObjectsQuery,
        //     );
        //     const countNewObjectQuery = `SELECT (COUNT(*) AS ?count)
        //     WHERE {
        //       ?s ?p ?o .
        //       FILTER(STRENDS(STR(?p), "blockchain") && STRENDS(STR(?o), "otp:2160"))
        //     }`;
        //     // eslint-disable-next-line no-await-in-loop
        //     const countNewObjectQueryResult = await this.tripleStoreModuleManager.select(
        //         this.repositoryImplementations[repository],
        //         TRIPLE_STORE_REPOSITORIES[repository],
        //         countNewObjectQuery,
        //     );
        //     this.logger.debug(
        //         `Report for UAL extentsion triple store migragrion on repository: ${repository}. Old subject count: ${JSON.stringify(
        //             countOldSujbectResult,
        //         )}. New subject count: ${JSON.stringify(
        //             countNewSujbectQuerryResult,
        //         )}. Old object count: ${JSON.stringify(
        //             countOldObjectsQueryResult,
        //         )}. New object count: ${JSON.stringify(countNewObjectQueryResult)}.`,
        //     );
        // }
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
