import { join } from 'path';
import appRootPath from 'app-root-path';
import BaseMigration from './base-migration.js';
import { LIBP2P_KEY_DIRECTORY, LIBP2P_KEY_FILENAME } from '../constants/constants.js';

class NetworkPrivateKeyMigration extends BaseMigration {
    async executeMigration() {
        const networkPrivateKey =
            this.config.modules?.network?.implementation?.['libp2p-service']?.config?.privateKey;

        if (networkPrivateKey) {
            let directoryPath;
            if (
                process.env.NODE_ENV === 'testnet' ||
                process.env.NODE_ENV === 'mainnet' ||
                process.env.NODE_ENV === 'devnet'
            ) {
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
            await this.fileService.writeContentsToFile(
                directoryPath,
                LIBP2P_KEY_FILENAME,
                networkPrivateKey,
            );
        }
    }
}

export default NetworkPrivateKeyMigration;
