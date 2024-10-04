import BaseMigration from './base-migration.js';
import { NODE_ENVIRONMENTS } from '../constants/constants.js';

class DevnetNeuroPruningMigration extends BaseMigration {
    constructor(migrationName, logger, config, repositoryModuleManager) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
    }

    async executeMigration() {
        if (process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVNET) {
            this.logger.info('Pruning Neuro devenet tables');
            // commands are not here as parsing JSON in SQL would take too much time
            const tables = [
                'blockchain',
                'blockchain_event',
                'event',
                'missed_paranet_asset',
                'paranet',
                'service_agreement',
                'shard',
            ];
            for (const table of tables) {
                const query = `
                  DELETE FROM ${table} 
                  WHERE blockchain_id = 'neuro:2160'`;
                // eslint-disable-next-line no-await-in-loop
                await this.repositoryModuleManager.query(query);
            }
        }
    }
}

export default DevnetNeuroPruningMigration;
