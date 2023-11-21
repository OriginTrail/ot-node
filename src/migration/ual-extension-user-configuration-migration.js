import appRootPath from 'app-root-path';
import path from 'path';
import BaseMigration from './base-migration.js';
import { CHAIN_IDS } from '../constants/constants.js';

const chainId = CHAIN_IDS[process.env.NODE_ENV];

class UalExtensionUserConfigurationMigration extends BaseMigration {
    constructor(migrationName, logger, config, repositoryModuleManager) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
    }

    async executeMigration() {
        const configurationFolderPath = path.join(appRootPath.path, '..');
        const configurationFilePath = path.join(
            configurationFolderPath,
            this.config.configFilename,
        );

        const userConfiguration = await this.fileService.readFile(configurationFilePath, true);

        const oldBlockchainId = this.getOldBlockchainId(userConfiguration);
        const newBlockchainId = `${oldBlockchainId}:${chainId}`;
        userConfiguration.modules.blockchain.implementation.defaultImplementation = newBlockchainId;
        userConfiguration.modules.blockchain.implementation[newBlockchainId] =
            userConfiguration.modules.blockchain.implementation[oldBlockchainId];
        delete userConfiguration.modules.blockchain.implementation[oldBlockchainId];
        await this.fileService.writeContentsToFile(
            configurationFolderPath,
            this.config.configFilename,
            JSON.stringify(userConfiguration, null, 4),
        );
    }

    getOldBlockchainId(userConfiguration) {
        let oldBlockchainId;
        if (userConfiguration.modules.blockchain.implementation) {
            for (const implementationName in userConfiguration.modules.blockchain.implementation) {
                if (
                    userConfiguration.modules.blockchain.implementation[implementationName].enabled
                ) {
                    oldBlockchainId = implementationName;
                }
            }
        }
        if (!oldBlockchainId) {
            throw Error('Unable to find old blockchain id in user configuration');
        }
        return oldBlockchainId;
    }
}

export default UalExtensionUserConfigurationMigration;
