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
            if (userConfiguration.modules.tripleStore.implementation) {
                for (const implementationName in userConfiguration.modules.tripleStore
                    .implementation) {
                    const oldImplementationConfig =
                        userConfiguration.modules.tripleStore.implementation[implementationName]
                            .config;
                    if (oldImplementationConfig && !oldImplementationConfig.repositories) {
                        let { url, username, password, repository } = oldImplementationConfig;

                        if (!url) {
                            url =
                                implementationName === 'ot-blazegraph'
                                    ? 'http://localhost:9999'
                                    : 'http://localhost:3030';
                        }

                        if (!username) {
                            username = 'admin';
                        }

                        if (!password) {
                            password = '';
                        }

                        if (!repository) {
                            if (implementationName === 'ot-blazegraph') {
                                repository = 'kb';
                            }
                            if (implementationName === 'ot-fuseki') {
                                repository = 'node0';
                            }
                        }
                        const newImplementationConfig = {
                            repositories: {
                                publicCurrent: {
                                    url,
                                    name: repository,
                                    username,
                                    password,
                                },
                                publicHistory: {
                                    url,
                                    name: 'public-history',
                                    username,
                                    password,
                                },
                                privateCurrent: {
                                    url,
                                    name: 'private-current',
                                    username,
                                    password,
                                },
                                privateHistory: {
                                    url,
                                    name: 'private-history',
                                    username,
                                    password,
                                },
                            },
                        };

                        userConfiguration.modules.tripleStore.implementation[
                            implementationName
                        ].config = newImplementationConfig;
                    }
                }
            } else {
                const configurationTemplatePath = path.join(
                    appRootPath.path,
                    'tools',
                    'local-network-setup',
                    '.origintrail_noderc_template.json',
                );
                const configurationTemplate = await this.fileService.loadJsonFromFile(
                    configurationTemplatePath,
                );

                if (
                    userConfiguration.modules.tripleStore.defaultImplementation === 'ot-blazegraph'
                ) {
                    userConfiguration.modules.tripleStore.implementation = {
                        'ot-blazegraph':
                            configurationTemplate.modules.tripleStore.implementation[
                                'ot-blazegraph'
                            ],
                    };
                    configurationTemplate.modules.tripleStore.implementation[
                        'ot-blazegraph'
                    ].enabled = true;
                    configurationTemplate.modules.tripleStore.implementation[
                        'ot-blazegraph'
                    ].config.repositories.publicCurrent.name = 'kb';
                } else if (
                    userConfiguration.modules.tripleStore.defaultImplementation === 'ot-fuseki'
                ) {
                    userConfiguration.modules.tripleStore.implementation = {
                        'ot-fuseki':
                            configurationTemplate.modules.tripleStore.implementation['ot-fuseki'],
                    };
                    configurationTemplate.modules.tripleStore.implementation[
                        'ot-fuseki'
                    ].enabled = true;
                    configurationTemplate.modules.tripleStore.implementation[
                        'ot-fuseki'
                    ].config.repositories.publicCurrent.name = 'node0';
                }
            }
            delete userConfiguration.modules.tripleStore.defaultImplementation;
            await this.fileService.writeContentsToFile(
                configurationFolderPath,
                this.config.configFilename,
                JSON.stringify(userConfiguration, null, 4),
            );
        }
    }
}

export default TripleStoreUserConfigurationMigration;
