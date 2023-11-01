import appRootPath from 'app-root-path';
import path from 'path';
import BaseMigration from './base-migration.js';
import { NODE_ENVIRONMENTS } from '../constants/constants.js';

const chainIds = {
    [NODE_ENVIRONMENTS.TESTNET]: 20430,
    [NODE_ENVIRONMENTS.MAINNET]: 2043,
    [NODE_ENVIRONMENTS.DEVELOPMENT]: 2160,
};
const chainId = chainIds[process.env.NODE_ENV];

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

        if (userConfiguration.modules.blockchain.implementation.otp) {
            const oldBlockchainId = 'otp';
            const newBlockchainId = `${oldBlockchainId}:${chainId}`;
            userConfiguration.modules.blockchain.implementation.defaultImplementation =
                newBlockchainId;
            userConfiguration.modules.blockchain.implementation[newBlockchainId] =
                userConfiguration.modules.blockchain.implementation[oldBlockchainId];
            delete userConfiguration.modules.blockchain.implementation[oldBlockchainId];
            await this.fileService.writeContentsToFile(
                configurationFolderPath,
                this.config.configFilename,
                JSON.stringify(userConfiguration, null, 4),
            );
        }
    }
}

export default UalExtensionUserConfigurationMigration;
