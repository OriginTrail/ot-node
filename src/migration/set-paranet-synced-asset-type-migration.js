import BaseMigration from './base-migration.js';
import { PARANET_SYNC_SOURCES } from '../constants/constants.js';

class SetParanetSyncedAssetTypeMigration extends BaseMigration {
    constructor(migrationName, logger, config, repositoryModuleManager) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
    }

    async executeMigration() {
        this.logger.info('Starting SetParanetSyncedAssetType migration.');
        const query = `
                  UPDATE paranet_synced_asset
                  SET data_source = ${PARANET_SYNC_SOURCES.SYNC}
                  `;
        await this.repositoryModuleManager.query(query);
    }
}

export default SetParanetSyncedAssetTypeMigration;
