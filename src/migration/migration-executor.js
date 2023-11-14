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
import ServiceAgreementsOpDatabaseMigration from './service-agreements-op-database-migration.js';

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
            'pullShardingTableMigrationV612',
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

    static async executeServiceAgreementsOpDatabaseMigration(container, logger, config) {
        // todo should we also exclude testnet?
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const blockchainModuleManager = container.resolve('blockchainModuleManager');
        const repositoryModuleManager = container.resolve('repositoryModuleManager');
        const serviceAgreementService = container.resolve('serviceAgreementService');
        const ualService = container.resolve('ualService');

        const migration = new ServiceAgreementsOpDatabaseMigration(
            'serviceAgreementsOpDatabaseMigration',
            logger,
            config,
            blockchainModuleManager,
            repositoryModuleManager,
            serviceAgreementService,
            ualService,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            await migration.migrate();
        }
    }

    static exitNode(code = 0) {
        process.exit(code);
    }
}

export default MigrationExecutor;
