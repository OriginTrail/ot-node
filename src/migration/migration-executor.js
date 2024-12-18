import path from 'path';

import { NODE_ENVIRONMENTS } from '../constants/constants.js';
import TripleStoreUserConfigurationMigration from './TripleStoreUserConfigurationMigration';

class MigrationExecutor {
    static async executeTripleStoreUserConfigurationMigration(container, logger, config) {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const migration = new TripleStoreUserConfigurationMigration(
            'tripleStoreUserConfigurationMigration',
            logger,
            config,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            try {
                await migration.migrate();
            } catch (error) {
                logger.error(
                    `Unable to execute triple store user configuration  migration. Error: ${error.message}`,
                );
            }
        }
    }

    static exitNode(code = 0) {
        process.exit(code);
    }

    static async migrationAlreadyExecuted(migrationName, fileService) {
        const migrationFilePath = path.join(fileService.getMigrationFolderPath(), migrationName);
        if (await fileService.pathExists(migrationFilePath)) {
            return true;
        }
        return false;
    }
}

export default MigrationExecutor;
