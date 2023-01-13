import path from 'path';
import appRootPath from 'app-root-path';
import BaseMigration from './base-migration.js';

class TripleStoreUserConfigurationMigration extends BaseMigration {
    async executeMigration() {
        if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
            const configurationFolderPath = path.join(appRootPath.path, '..');
            const configurationFilePath = path.join(
                configurationFolderPath,
                this.config.configFilename,
            );

            const userConfiguration = await this.fileService.loadJsonFromFile(
                configurationFilePath,
            );

            if (userConfiguration.modules.tripleStore?.implementation) {
                for (const implementationName in userConfiguration.modules.tripleStore
                    .implementation) {
                    const oldImplementationConfig =
                        userConfiguration.modules.tripleStore.implementation[implementationName]
                            .config;
                    if (oldImplementationConfig && !oldImplementationConfig.repositories) {
                        const newImplementationConfig = {
                            repositories: {
                                publicCurrent: oldImplementationConfig,
                            },
                        };
                        newImplementationConfig.repositories.publicCurrent.name =
                            newImplementationConfig.repositories.publicCurrent.repository;
                        delete newImplementationConfig.repositories.publicCurrent.repository;
                        if (implementationName === 'ot-blazegraph') {
                            newImplementationConfig.repositories.publicCurrent.name = 'kb';
                        }

                        userConfiguration.modules.tripleStore.implementation[
                            implementationName
                        ].config = newImplementationConfig;
                    }
                }
                await this.fileService.writeContentsToFile(
                    configurationFolderPath,
                    this.config.configFilename,
                    JSON.stringify(userConfiguration, null, 4),
                );
            }
        }
    }
}

export default TripleStoreUserConfigurationMigration;
