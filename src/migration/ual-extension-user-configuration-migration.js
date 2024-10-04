import appRootPath from 'app-root-path';
import path from 'path';
import BaseMigration from './base-migration.js';

const CHAIN_IDS = {
    development: 31337,
    test: 31337,
    devnet: 2160,
    testnet: 20430,
    mainnet: 2043,
};
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

        if (this.blockchainIdInNewFormat(oldBlockchainId)) {
            this.logger.info(
                'Blockchain id in user configuration already updated to be in new format, migration will be skipped',
            );
            return null;
        }

        const newBlockchainId = `${oldBlockchainId}:${chainId}`;
        userConfiguration.modules.blockchain.defaultImplementation = newBlockchainId;
        userConfiguration.modules.blockchain.implementation[newBlockchainId] =
            userConfiguration.modules.blockchain.implementation[oldBlockchainId];
        userConfiguration.modules.blockchain.implementation[newBlockchainId].enabled = true;
        delete userConfiguration.modules.blockchain.implementation[oldBlockchainId];
        await this.fileService.writeContentsToFile(
            configurationFolderPath,
            this.config.configFilename,
            JSON.stringify(userConfiguration, null, 4),
        );
    }

    blockchainIdInNewFormat(blockchainId) {
        return blockchainId.includes(':');
    }

    getOldBlockchainId(userConfiguration) {
        let oldBlockchainId;
        if (userConfiguration.modules.blockchain.implementation) {
            for (const implementationName in userConfiguration.modules.blockchain.implementation) {
                if (implementationName.includes('neuro')) {
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
