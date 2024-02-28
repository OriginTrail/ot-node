import BaseMigration from './base-migration.js';
import { NODE_ENVIRONMENTS } from '../constants/constants.js';

class GetOldServiceAgreementsMigration extends BaseMigration {
    constructor(migrationName, logger, config, repositoryModuleManager) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
    }

    async executeMigration() {
        if (
            process.env.NODE_ENV !== NODE_ENVIRONMENTS.DEVELOPMENT &&
            process.env.NODE_ENV !== NODE_ENVIRONMENTS.TEST
        ) {
            // This migration is only preforemed on Gnosis blockchain
            if (
                this.blockchainModuleManager
                    .getImplementationNames()
                    .some((s) => s.startsWith('gnosis'))
            ) {
                // Migration logic goes here
            }
        }
    }
}

export default GetOldServiceAgreementsMigration;
