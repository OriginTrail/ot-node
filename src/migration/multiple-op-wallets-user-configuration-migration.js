import appRootPath from 'app-root-path';
import path from 'path';
import BaseMigration from './base-migration.js';

class MultipleOpWalletsUserConfigurationMigration extends BaseMigration {
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

        for (const blockchainId in userConfiguration?.modules?.blockchain) {
            const blockchain = userConfiguration?.modules?.blockchain[blockchainId];

            if (blockchain?.config.operationalWallets) {
                try {
                    blockchain.config.operationalWallets = [
                        {
                            evmPublicKey: blockchain.config.evmOperationalWalletPublicKey ?? '',
                            evmPrivateKey: blockchain.config.evmOperationalWalletPrivateKey ?? '',
                        },
                    ];
                    delete blockchain.config.evmOperationalWalletPublicKey;
                    delete blockchain.config.evmOperationalWalletPrivateKey;
                    this.logger.trace(
                        `${this.migrationName}: User configuration updated for blockchain: ${blockchainId}`,
                    );
                } catch (error) {
                    this.logger.warn(
                        `${this.migrationName}: Error while updating user configuration for blockchain: ${blockchainId}, error: ${error}`,
                    );
                }
            } else {
                this.logger.trace(
                    `${this.migrationName}: Skipping user configuration update for blockchain: ${blockchainId}. Configuration in new format.`,
                );
            }
        }

        await this.fileService.writeContentsToFile(
            configurationFolderPath,
            this.config.configFilename,
            JSON.stringify(userConfiguration, null, 4),
        );
    }
}

export default MultipleOpWalletsUserConfigurationMigration;
