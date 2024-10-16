import BaseMigration from './base-migration.js';
import { NODE_ENVIRONMENTS } from '../constants/constants.js';

class DevnetPruningMigration extends BaseMigration {
    constructor(migrationName, logger, config, repositoryModuleManager) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
    }

    async executeMigration() {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVNET ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TESTNET
        ) {
            this.logger.info('Pruning devenet operational tables');
            // commands are not here as parsing JSON in SQL would take too much time
            const tables = [
                'blockchain',
                'blockchain_event',
                'commands',
                'event',
                'get', // Reserved word in SQL
                'get_response',
                'missed_paranet_asset',
                'operation_ids',
                'paranet',
                'publish',
                'publish_response',
                'service_agreement',
                'update',
                'update_response',
                'shard',
            ];
            for (const table of tables) {
                const query = `
                TRUNCATE TABLE \`${table}\`;
              `;

                // eslint-disable-next-line no-await-in-loop
                await this.repositoryModuleManager.query(query);
            }
        }
    }
}

export default DevnetPruningMigration;
