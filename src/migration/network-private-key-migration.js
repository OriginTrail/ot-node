import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import BaseMigration from './base-migration.js';
import { LIBP2P_KEY_DIRECTORY, LIBP2P_KEY_FILENAME } from '../constants/constants.js';

class NetworkPrivateKeyMigration extends BaseMigration {
    async executeMigration() {
        const networkPrivateKey =
            this.config.modules?.network?.implementation?.['libp2p-service']?.config?.privateKey;

        if (networkPrivateKey) {
            try {
                const directoryPath = join(this.config.appDataPath, LIBP2P_KEY_DIRECTORY);
                const fullPath = join(directoryPath, LIBP2P_KEY_FILENAME);
                await mkdir(directoryPath, { recursive: true });
                await writeFile(fullPath, networkPrivateKey);
            } catch (error) {
                this.logger.warn(`Unable to execute migration: ${this.migrationName}`);
            }
        }
    }
}

export default NetworkPrivateKeyMigration;
