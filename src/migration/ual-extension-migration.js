import appRootPath from 'app-root-path';
import path from 'path';
import BaseMigration from './base-migration.js';

class UalExtensionMigration extends BaseMigration {
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

        const promises = [];

        // user configuration migration
        if (userConfiguration.modules.blockchain.implementation) {
            for (const implementationName in userConfiguration.modules.blockchain.implementation) {
                const implementation =
                    userConfiguration.modules.block.implementation[implementationName];

                if (implementation.chainId || implementation.blockchainId) {
                    // todo update chainId and blockchain Id or remove them totally
                    implementation.chainId = '';
                    promises.add(
                        this.fileService.writeContentsToFile(
                            configurationFolderPath,
                            this.config.configFilename,
                            JSON.stringify(userConfiguration, null, 4),
                        ),
                    );
                }
            }
        }

        this.logger.trace('Ual extension user migration completed');

        // triple store migration

        await Promise.all(promises);
    }
}

export default UalExtensionMigration;
