import BaseMigration from './base-migration.js';
import { TRIPLE_STORE, SCHEMA_CONTEXT } from '../constants/constants.js';

class RemoveAgreementStartEndTimeMigration extends BaseMigration {
    constructor(migrationName, logger, config, tripleStoreService) {
        super(migrationName, logger, config);
        this.tripleStoreService = tripleStoreService;
    }

    async executeMigration() {
        const repositories = Object.values(TRIPLE_STORE.REPOSITORIES);
        const query = `
            PREFIX schema: <${SCHEMA_CONTEXT}>

            DELETE {
                GRAPH <assets:graph> {
                    ?ual schema:agreementEndTime ?agreementEndTime .
                    ?ual schema:agreementStartTime ?agreementStartTime .
                }
            }
            WHERE {
                GRAPH <assets:graph> {
                    { ?ual schema:agreementEndTime ?agreementEndTime . }
                        UNION
                    { ?ual schema:agreementStartTime ?agreementStartTime . }
                }
            }`;

        await Promise.all(
            repositories.map((repository) => this.tripleStoreService.queryVoid(repository, query)),
        );
    }
}

export default RemoveAgreementStartEndTimeMigration;
