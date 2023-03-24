import path from 'path';
import appRootPath from 'app-root-path';
import BaseMigration from './base-migration.js';
import { NODE_ENVIRONMENTS } from '../constants/constants.js';

class BlockchainIdentityMigration extends BaseMigration {
    async executeMigration() {
        if (
            process.env.NODE_ENV !== NODE_ENVIRONMENTS.DEVELOPMENT &&
            process.env.NODE_ENV !== NODE_ENVIRONMENTS.TEST
        ) {
            const configurationFolderPath = path.join(appRootPath.path, '..');
            const configurationFilePath = path.join(
                configurationFolderPath,
                this.config.configFilename,
            );

            const config = await this.fileService.loadJsonFromFile(configurationFilePath);
            for (const blockchainImpl in config.modules.blockchain.implementation) {
                delete config.modules.blockchain.implementation[blockchainImpl].config.identity;
            }
            await this.fileService.writeContentsToFile(
                configurationFolderPath,
                this.config.configFilename,
                JSON.stringify(config, null, 4),
            );
        }
    }
}

export default BlockchainIdentityMigration;
