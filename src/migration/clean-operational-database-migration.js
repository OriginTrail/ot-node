import BaseMigration from './base-migration.js';
import { NODE_ENVIRONMENTS } from '../constants/constants.js';

class CleanOperationalDatabaseMigration extends BaseMigration {
    constructor(migrationName, logger, config, repositoryModuleManager) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
    }

    async executeMigration() {
        if (
            process.env.NODE_ENV !== NODE_ENVIRONMENTS.DEVELOPMENT &&
            process.env.NODE_ENV !== NODE_ENVIRONMENTS.TEST
        ) {
            this.logger.info('Dropping old operational database.');
            await this.repositoryModuleManager.dropDatabase();
        }
    }
}

export default CleanOperationalDatabaseMigration;
