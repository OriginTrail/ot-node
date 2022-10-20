import { join } from 'path';
import appRootPath from 'app-root-path';
import { mkdir, writeFile } from 'fs/promises';
import BaseMigration from './base-migration.js';
import { LIBP2P_KEY_DIRECTORY, LIBP2P_KEY_FILENAME } from '../constants/constants.js';

class NetworkPrivateKeyMigration extends BaseMigration {
    async executeMigration() {
        const networkPrivateKey =
            this.config.modules?.network?.implementation?.['libp2p-service']?.config?.privateKey;

        if (networkPrivateKey) {
            let directoryPath;
            if (process.env.NODE_ENV === 'testnet' || process.env.NODE_ENV === 'mainnet') {
                directoryPath = join(
                    appRootPath.path,
                    '..',
                    this.config.appDataPath,
                    LIBP2P_KEY_DIRECTORY,
                );
            } else {
                directoryPath = join(
                    appRootPath.path,
                    this.config.appDataPath,
                    LIBP2P_KEY_DIRECTORY,
                );
            }
            const fullPath = join(directoryPath, LIBP2P_KEY_FILENAME);
            await mkdir(directoryPath, { recursive: true });
            await writeFile(fullPath, networkPrivateKey);
        }
    }
}

export default NetworkPrivateKeyMigration;
