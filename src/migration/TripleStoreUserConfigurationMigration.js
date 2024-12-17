import appRootPath from 'app-root-path';
import path from 'path';
import BaseMigration from './base-migration.js';

class TripleStoreUserConfigurationMigration extends BaseMigration {
    async executeMigration() {
        const configurationFolderPath = path.join(appRootPath.path, '..');
        const configurationFilePath = path.join(
            configurationFolderPath,
            this.config.configFilename,
        );

        const userConfiguration = await this.fileService.readFile(configurationFilePath, true);

        if ('tripleStore' in userConfiguration.modules) {
            const oldConfigTripleStore = userConfiguration.modules;
            for (const implementation in oldConfigTripleStore.tripleStore.implementation) {
                if (oldConfigTripleStore.tripleStore.implementation[implementation].enabled) {
                    const { url, username, password } =
                        oldConfigTripleStore.tripleStore.implementation[implementation].config
                            .repositories.publicCurrent;

                    oldConfigTripleStore.tripleStore.implementation[
                        implementation
                    ].config.repositories.dkg = {
                        url,
                        name: 'dkg',
                        username,
                        password,
                    };
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

export default TripleStoreUserConfigurationMigration;
