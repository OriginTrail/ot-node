import BaseMigration from './base-migration.js';
import { TRIPLE_STORE_REPOSITORIES, SCHEMA_CONTEXT } from '../constants/constants.js';

class ServiceAgreementsMetadataMigraion extends BaseMigration {
    constructor(migrationName, logger, config, tripleStoreService) {
        super(migrationName, logger, config);
        this.tripleStoreService = tripleStoreService;
    }

    async executeMigration() {
        const repositories = Object.values(TRIPLE_STORE_REPOSITORIES);
        const query = `
            PREFIX schema: <${SCHEMA_CONTEXT}>
            DELETE {
                GRAPH <assets:graph> {
                    ?ual schema:agreementEndTime ?agreementEndTime.
                }
            }
            WHERE {
                GRAPH <assets:graph> {
                    ?ual schema:agreementEndTime ?agreementEndTime.
                }
            }`;

        await Promise.all(
            repositories.map((repository) => this.tripleStoreService.queryVoid(repository, query)),
        );
    }
}

export default ServiceAgreementsMetadataMigraion;
