import appRootPath from 'app-root-path';
import path from 'path';
import BaseMigration from './base-migration.js';

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

        // user configuration migration
        if (userConfiguration.modules.blockchain.implementation.otp) {
            // todo add chain id in implementation name
            userConfiguration.modules.blockchain.implementation['otp:'] =
                userConfiguration.modules.blockchain.implementation.otp;
            delete userConfiguration.modules.blockchain.implementation.otp;
            await this.fileService.writeContentsToFile(
                configurationFolderPath,
                this.config.configFilename,
                JSON.stringify(userConfiguration, null, 4),
            );
        }
    }
}

export default UalExtensionUserConfigurationMigration;
