import path from 'path';
import { NODE_ENVIRONMENTS } from '../constants/constants.js';
import PullBlockchainShardingTableMigration from './pull-sharding-table-migration.js';
import PrivateAssetsMetadataMigration from './private-assets-metadata-migration.js';
import TelemetryModuleUserConfigurationMigration from './telemetry-module-user-configuration-migration.js';
import TripleStoreUserConfigurationMigration from './triple-store-user-configuration-migration.js';
import ServiceAgreementsMetadataMigration from './service-agreements-metadata-migration.js';
import RemoveAgreementStartEndTimeMigration from './remove-agreement-start-end-time-migration.js';
import TripleStoreMetadataMigration from './triple-store-metadata-migration.js';
import RemoveOldEpochCommandsMigration from './remove-old-epoch-commands-migration.js';
import PendingStorageMigration from './pending-storage-migration.js';
import MarkOldBlockchainEventsAsProcessedMigration from './mark-old-blockchain-events-as-processed-migration.js';
import ServiceAgreementsDataInspector from './service-agreements-data-inspector.js';
import ServiceAgreementsInvalidDataMigration from './service-agreements-invalid-data-migration.js';
import UalExtensionUserConfigurationMigration from './ual-extension-user-configuration-migration.js';
import UalExtensionTripleStoreMigration from './ual-extension-triple-store-migration.js';
import MarkStakingEventsAsProcessedMigration from './mark-staking-events-as-processed-migration.js';
import RemoveServiceAgreementsForChiadoMigration from './remove-service-agreements-for-chiado-migration.js';
import MultipleOpWalletsUserConfigurationMigration from './multiple-op-wallets-user-configuration-migration.js';
import GetOldServiceAgreementsMigration from './get-old-service-agreements-migration.js';
import ServiceAgreementPruningMigration from './service-agreement-pruning-migration.js';
import RemoveDuplicateServiceAgreementMigration from './remove-duplicate-service-agreement-migration.js';
import DevnetNeuroPruningMigration from './devnet-neuro-pruning-migration.js';
import ServiceAgreementFixMigration from './service-agreement-fix-migration.js';

class MigrationExecutor {
    static async executePullShardingTableMigration(container, logger, config) {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const blockchainModuleManager = container.resolve('blockchainModuleManager');
        const repositoryModuleManager = container.resolve('repositoryModuleManager');
        const validationModuleManager = container.resolve('validationModuleManager');

        const migration = new PullBlockchainShardingTableMigration(
            'pullShardingTableMigrationV620Hotfix11',
            logger,
            config,
            repositoryModuleManager,
            blockchainModuleManager,
            validationModuleManager,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            await migration.migrate();
        }
    }

    static async executePrivateAssetsMetadataMigration(container, logger, config) {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;
        const blockchainModuleManager = container.resolve('blockchainModuleManager');
        const tripleStoreService = container.resolve('tripleStoreService');
        const serviceAgreementService = container.resolve('serviceAgreementService');
        const ualService = container.resolve('ualService');
        const dataService = container.resolve('dataService');

        const migration = new PrivateAssetsMetadataMigration(
            'privateAssetsMetadataMigration',
            logger,
            config,
            tripleStoreService,
            blockchainModuleManager,
            serviceAgreementService,
            ualService,
            dataService,
        );

        if (!(await migration.migrationAlreadyExecuted())) {
            await migration.migrate();
            logger.info('Node will now restart!');
            MigrationExecutor.exitNode(1);
        }
    }

    static async executeTelemetryModuleUserConfigurationMigration(logger, config) {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const migration = new TelemetryModuleUserConfigurationMigration(
            'telemetryModuleUserConfigurationMigration',
            logger,
            config,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            await migration.migrate();
            logger.info('Node will now restart!');
            MigrationExecutor.exitNode(1);
        }
    }

    static async executeTripleStoreUserConfigurationMigration(logger, config) {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const migration = new TripleStoreUserConfigurationMigration(
            'tripleStoreUserConfigurationMigration',
            logger,
            config,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            await migration.migrate();
            logger.info('Node will now restart!');
            MigrationExecutor.exitNode(1);
        }
    }

    static async executeServiceAgreementsMetadataMigration(container, logger, config) {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const blockchainModuleManager = container.resolve('blockchainModuleManager');
        const repositoryModuleManager = container.resolve('repositoryModuleManager');
        const tripleStoreService = container.resolve('tripleStoreService');
        const serviceAgreementService = container.resolve('serviceAgreementService');
        const ualService = container.resolve('ualService');

        const migration = new ServiceAgreementsMetadataMigration(
            'serviceAgreementsMetadataMigration',
            logger,
            config,
            tripleStoreService,
            blockchainModuleManager,
            repositoryModuleManager,
            serviceAgreementService,
            ualService,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            await migration.migrate();
        }
    }

    static async executeRemoveAgreementStartEndTimeMigration(container, logger, config) {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const tripleStoreService = container.resolve('tripleStoreService');

        const migration = new RemoveAgreementStartEndTimeMigration(
            'removeAgreementStartEndTimeMigration',
            logger,
            config,
            tripleStoreService,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            await migration.migrate();
        }
    }

    static async executeTripleStoreMetadataMigration(container, logger, config) {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;
        const blockchainModuleManager = container.resolve('blockchainModuleManager');
        const tripleStoreService = container.resolve('tripleStoreService');
        const serviceAgreementService = container.resolve('serviceAgreementService');
        const ualService = container.resolve('ualService');
        const dataService = container.resolve('dataService');

        const migration = new TripleStoreMetadataMigration(
            'tripleStoreMetadataMigration',
            logger,
            config,
            tripleStoreService,
            blockchainModuleManager,
            serviceAgreementService,
            ualService,
            dataService,
        );

        if (!(await migration.migrationAlreadyExecuted())) {
            await migration.migrate();
        }
    }

    static async executeRemoveOldEpochCommandsMigration(container, logger, config) {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const repositoryModuleManager = container.resolve('repositoryModuleManager');

        const migration = new RemoveOldEpochCommandsMigration(
            'removeOldEpochCommandsMigration',
            logger,
            config,
            repositoryModuleManager,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            await migration.migrate();
        }
    }

    static async executePendingStorageMigration(logger, config) {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const migration = new PendingStorageMigration('pendingStorageMigration', logger, config);
        if (!(await migration.migrationAlreadyExecuted())) {
            await migration.migrate();
        }
    }

    static async executeMarkOldBlockchainEventsAsProcessedMigration(container, logger, config) {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const repositoryModuleManager = container.resolve('repositoryModuleManager');

        const migration = new MarkOldBlockchainEventsAsProcessedMigration(
            'markOldBlockchainEventsAsProcessedMigration',
            logger,
            config,
            repositoryModuleManager,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            await migration.migrate();
        }
    }

    static async executeServiceAgreementsDataInspector(container, logger, config) {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const blockchainModuleManager = container.resolve('blockchainModuleManager');
        const repositoryModuleManager = container.resolve('repositoryModuleManager');
        const tripleStoreService = container.resolve('tripleStoreService');
        const ualService = container.resolve('ualService');
        const serviceAgreementService = container.resolve('serviceAgreementService');

        const migration = new ServiceAgreementsDataInspector(
            'serviceAgreementsDataInspector',
            logger,
            config,
            blockchainModuleManager,
            repositoryModuleManager,
            tripleStoreService,
            ualService,
            serviceAgreementService,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            await migration.migrate();
            logger.info('Node will now restart!');
            MigrationExecutor.exitNode(1);
        }
    }

    static async executeServiceAgreementsInvalidDataMigration(container, logger, config) {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const repositoryModuleManager = container.resolve('repositoryModuleManager');
        const tripleStoreService = container.resolve('tripleStoreService');

        const migration = new ServiceAgreementsInvalidDataMigration(
            'serviceAgreementsInvalidDataMigration',
            logger,
            config,
            repositoryModuleManager,
            tripleStoreService,
        );
        if (
            (await migration.migrationAlreadyExecuted('serviceAgreementsDataInspector')) &&
            !(await migration.migrationAlreadyExecuted())
        ) {
            await migration.migrate();
        }
    }

    static async executeUalExtensionUserConfigurationMigration(logger, config) {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const migration = new UalExtensionUserConfigurationMigration(
            'ualExtensionUserConfigurationMigration',
            logger,
            config,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            await migration.migrate();
            logger.info('Node will now restart!');
            this.exitNode(1);
        }
    }

    static async executeUalExtensionTripleStoreMigration(container, logger, config) {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const tripleStoreService = container.resolve('tripleStoreService');

        const migration = new UalExtensionTripleStoreMigration(
            'ualExtensionTripleStoreMigration',
            logger,
            config,
            tripleStoreService,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            try {
                await migration.migrate();
            } catch (error) {
                logger.error(
                    `Unable to execute ual extension triple store migration. Error: ${error.message}`,
                );
                this.exitNode(1);
            }
        }
    }

    static async executeMarkStakingEventsAsProcessedMigration(container, logger, config) {
        if (process.env.NODE_ENV !== NODE_ENVIRONMENTS.MAINNET) return;

        const repositoryModuleManager = container.resolve('repositoryModuleManager');
        const blockchainModuleManager = container.resolve('blockchainModuleManager');

        const migration = new MarkStakingEventsAsProcessedMigration(
            'markStakingEventsAsProcessedMigration',
            logger,
            config,
            repositoryModuleManager,
            blockchainModuleManager,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            try {
                await migration.migrate();
            } catch (error) {
                logger.error(
                    `Unable to execute mark staking events as processed migration. Error: ${error.message}`,
                );
                this.exitNode(1);
            }
        }
    }

    static async executeRemoveServiceAgreementsForChiadoMigration(container, logger, config) {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVNET ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TESTNET
        ) {
            const repositoryModuleManager = container.resolve('repositoryModuleManager');

            const migration = new RemoveServiceAgreementsForChiadoMigration(
                'removeServiceAgreementsForChiadoMigrationV6.2.0.Hotfix11',
                logger,
                config,
                repositoryModuleManager,
            );
            if (!(await migration.migrationAlreadyExecuted())) {
                try {
                    await migration.migrate();
                } catch (error) {
                    logger.error(
                        `Unable to execute remove service agreements for Chiado migration. Error: ${error.message}`,
                    );
                    this.exitNode(1);
                }
            }
        }
    }

    static async executeMultipleOpWalletsUserConfigurationMigration(container, logger, config) {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const migration = new MultipleOpWalletsUserConfigurationMigration(
            'multipleOpWalletsUserConfigurationMigration',
            logger,
            config,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            try {
                await migration.migrate();
            } catch (error) {
                logger.error(
                    `Unable to execute multiple op wallets user configuration migration. Error: ${error.message}`,
                );
            }
        }
    }

    static async executeGetOldServiceAgreementsMigration(container, logger, config) {
        if (process.env.NODE_ENV !== NODE_ENVIRONMENTS.MAINNET) return;

        const repositoryModuleManager = container.resolve('repositoryModuleManager');
        const blockchainModuleManager = container.resolve('blockchainModuleManager');
        const serviceAgreementService = container.resolve('serviceAgreementService');

        const migration = new GetOldServiceAgreementsMigration(
            'getOldServiceAgreementsMigrationv623',
            logger,
            config,
            repositoryModuleManager,
            blockchainModuleManager,
            serviceAgreementService,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            try {
                await migration.migrate();
            } catch (error) {
                logger.error(
                    `Unable to execute get old service agreements migration. Error: ${error.message}`,
                );
            }
        }
    }

    static async executeServiceAgreementPruningMigration(container, logger, config) {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const repositoryModuleManager = container.resolve('repositoryModuleManager');
        const blockchainModuleManager = container.resolve('blockchainModuleManager');
        const serviceAgreementService = container.resolve('serviceAgreementService');

        const migration = new ServiceAgreementPruningMigration(
            'serviceAgreementPruningMigration',
            logger,
            config,
            repositoryModuleManager,
            blockchainModuleManager,
            serviceAgreementService,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            try {
                await migration.migrate();
            } catch (error) {
                logger.error(
                    `Unable to execute service agreement pruning migration. Error: ${error.message}`,
                );
            }
        }
    }

    static async executeRemoveDuplicateServiceAgreementMigration(container, logger, config) {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const repositoryModuleManager = container.resolve('repositoryModuleManager');
        const blockchainModuleManager = container.resolve('blockchainModuleManager');

        const migration = new RemoveDuplicateServiceAgreementMigration(
            'removeDuplicateServiceAgreementMigration',
            logger,
            config,
            repositoryModuleManager,
            blockchainModuleManager,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            try {
                await migration.migrate();
            } catch (error) {
                logger.error(
                    `Unable to execute remove duplicate service agreement migration. Error: ${error.message}`,
                );
            }
        }
    }

    static async executeDevnetNeuroPruningMigration(container, logger, config) {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const repositoryModuleManager = container.resolve('repositoryModuleManager');

        const migration = new DevnetNeuroPruningMigration(
            'devnetNeuroPruningMigration',
            logger,
            config,
            repositoryModuleManager,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            try {
                await migration.migrate();
            } catch (error) {
                logger.error(
                    `Unable to execute devnet neuro pruning migration. Error: ${error.message}`,
                );
            }
        }
    }

    static async executeServiceAgreementFixMigration(container, logger, config) {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const repositoryModuleManager = container.resolve('repositoryModuleManager');
        const blockchainModuleManager = container.resolve('blockchainModuleManager');
        const serviceAgreementService = container.resolve('serviceAgreementService');

        const migration = new ServiceAgreementFixMigration(
            'serviceAgreementFixMigration',
            logger,
            config,
            repositoryModuleManager,
            blockchainModuleManager,
            serviceAgreementService,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            try {
                await migration.migrate();
            } catch (error) {
                logger.error(
                    `Unable to execute service agreement fix migration. Error: ${error.message}`,
                );
            }
        }
    }

    static exitNode(code = 0) {
        process.exit(code);
    }

    static async migrationAlreadyExecuted(migrationName, fileService) {
        const migrationFilePath = path.join(fileService.getMigrationFolderPath(), migrationName);
        if (await fileService.pathExists(migrationFilePath)) {
            return true;
        }
        return false;
    }
}

export default MigrationExecutor;
