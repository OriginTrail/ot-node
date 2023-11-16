import DeepExtend from 'deep-extend';
import rc from 'rc';
import EventEmitter from 'events';
import { createRequire } from 'module';
import { execSync } from 'child_process';
import DependencyInjection from './src/service/dependency-injection.js';
import Logger from './src/logger/logger.js';
import { MIN_NODE_VERSION, NODE_ENVIRONMENTS } from './src/constants/constants.js';
import FileService from './src/service/file-service.js';
import OtnodeUpdateCommand from './src/commands/common/otnode-update-command.js';
import OtAutoUpdater from './src/modules/auto-updater/implementation/ot-auto-updater.js';
import PullBlockchainShardingTableMigration from './src/migration/pull-sharding-table-migration.js';
import TripleStoreUserConfigurationMigration from './src/migration/triple-store-user-configuration-migration.js';
import TelemetryModuleUserConfigurationMigration from './src/migration/telemetry-module-user-configuration-migration.js';
import PrivateAssetsMetadataMigration from './src/migration/private-assets-metadata-migration.js';
import ServiceAgreementsMetadataMigration from './src/migration/service-agreements-metadata-migration.js';
import RemoveAgreementStartEndTimeMigration from './src/migration/remove-agreement-start-end-time-migration.js';
import MarkOldBlockchainEventsAsProcessedMigration from './src/migration/mark-old-blockchain-events-as-processed-migration.js';
import TripleStoreMetadataMigration from './src/migration/triple-store-metadata-migration.js';
import RemoveOldEpochCommandsMigration from './src/migration/remove-old-epoch-commands-migration.js';
import PendingStorageMigration from './src/migration/pending-storage-migration.js';
import ServiceAgreementsDataInspector from './src/migration/service-agreements-data-inspector.js';

const require = createRequire(import.meta.url);
const pjson = require('./package.json');
const configjson = require('./config/config.json');

class OTNode {
    constructor(config) {
        this.initializeConfiguration(config);
        this.initializeLogger();
        this.initializeFileService();
        this.initializeAutoUpdaterModule();
        this.checkNodeVersion();
    }

    async start() {
        await this.checkForUpdate();
        await this.removeUpdateFile();
        await this.executeTripleStoreUserConfigurationMigration();
        await this.executeTelemetryModuleUserConfigurationMigration();
        this.logger.info(' ██████╗ ████████╗███╗   ██╗ ██████╗ ██████╗ ███████╗');
        this.logger.info('██╔═══██╗╚══██╔══╝████╗  ██║██╔═══██╗██╔══██╗██╔════╝');
        this.logger.info('██║   ██║   ██║   ██╔██╗ ██║██║   ██║██║  ██║█████╗');
        this.logger.info('██║   ██║   ██║   ██║╚██╗██║██║   ██║██║  ██║██╔══╝');
        this.logger.info('╚██████╔╝   ██║   ██║ ╚████║╚██████╔╝██████╔╝███████╗');
        this.logger.info(' ╚═════╝    ╚═╝   ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚══════╝');

        this.logger.info('======================================================');
        this.logger.info(`             OriginTrail Node v${pjson.version}`);
        this.logger.info('======================================================');
        this.logger.info(`Node is running in ${process.env.NODE_ENV} environment`);

        await this.initializeDependencyContainer();
        this.initializeEventEmitter();

        await this.initializeModules();
        await this.executePullShardingTableMigration();
        await this.executePrivateAssetsMetadataMigration();
        await this.executeRemoveAgreementStartEndTimeMigration();
        await this.executeMarkOldBlockchainEventsAsProcessedMigration();
        await this.executeTripleStoreMetadataMigration();
        await this.executeServiceAgreementsMetadataMigration();
        await this.executeRemoveOldEpochCommandsMigration();
        await this.executePendingStorageMigration();
        await this.executeServiceAgreementsMetadataMigration(
            this.container,
            this.logger,
            this.config,
        );
        await this.createProfiles();

        await this.initializeCommandExecutor();
        await this.initializeShardingTableService();
        await this.initializeBlockchainEventListenerService();

        await this.initializeRouters();
        await this.startNetworkModule();
        this.startTelemetryModule();
        this.resumeCommandExecutor();
        this.logger.info('Node is up and running!');
    }

    checkNodeVersion() {
        const nodeMajorVersion = process.versions.node.split('.')[0];
        this.logger.warn('======================================================');
        this.logger.warn(`Using node.js version: ${process.versions.node}`);
        if (nodeMajorVersion < MIN_NODE_VERSION) {
            this.logger.warn(
                `This node was tested with node.js version 16. To make sure that your node is running properly please update your node version!`,
            );
        }
        this.logger.warn('======================================================');
    }

    async executeServiceAgreementsDataInspector(container, logger, config) {
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
            migration.migrate();
            logger.info('Node will now restart!');
            this.stop(1);
        }
    }

    initializeLogger() {
        this.logger = new Logger(this.config.logLevel);
    }

    initializeFileService() {
        this.fileService = new FileService({ config: this.config, logger: this.logger });
    }

    initializeAutoUpdaterModule() {
        this.autoUpdaterModuleManager = new OtAutoUpdater();
        this.autoUpdaterModuleManager.initialize(
            this.config.modules.autoUpdater.implementation['ot-auto-updater'].config,
            this.logger,
        );
    }

    initializeConfiguration(userConfig) {
        const defaultConfig = JSON.parse(JSON.stringify(configjson[process.env.NODE_ENV]));

        if (userConfig) {
            this.config = DeepExtend(defaultConfig, userConfig);
        } else {
            this.config = rc(pjson.name, defaultConfig);
        }
        if (!this.config.configFilename) {
            // set default user configuration filename
            this.config.configFilename = '.origintrail_noderc';
        }
    }

    async initializeDependencyContainer() {
        this.container = await DependencyInjection.initialize();
        DependencyInjection.registerValue(this.container, 'config', this.config);
        DependencyInjection.registerValue(this.container, 'logger', this.logger);

        this.logger.info('Dependency injection module is initialized');
    }

    async initializeModules() {
        const initializationPromises = [];
        for (const moduleName in this.config.modules) {
            const moduleManagerName = `${moduleName}ModuleManager`;

            const moduleManager = this.container.resolve(moduleManagerName);
            initializationPromises.push(moduleManager.initialize());
        }
        try {
            await Promise.all(initializationPromises);
            this.logger.info(`All modules initialized!`);
        } catch (e) {
            this.logger.error(`Module initialization failed. Error message: ${e.message}`);
            this.stop(1);
        }
    }

    initializeEventEmitter() {
        const eventEmitter = new EventEmitter();
        DependencyInjection.registerValue(this.container, 'eventEmitter', eventEmitter);

        this.logger.info('Event emitter initialized');
    }

    async initializeBlockchainEventListenerService() {
        try {
            const eventListenerService = this.container.resolve('blockchainEventListenerService');
            await eventListenerService.initialize();
            eventListenerService.startListeningOnEvents();
            this.logger.info('Event Listener Service initialized successfully');
        } catch (error) {
            this.logger.error(
                `Unable to initialize event listener service. Error message: ${error.message} OT-node shutting down...`,
            );
            this.stop(1);
        }
    }

    async initializeRouters() {
        try {
            this.logger.info('Initializing http api and rpc router');

            const routerNames = ['httpApiRouter', 'rpcRouter'];
            await Promise.all(
                routerNames.map(async (routerName) => {
                    const router = this.container.resolve(routerName);
                    try {
                        await router.initialize();
                    } catch (error) {
                        this.logger.error(
                            `${routerName} initialization failed. Error message: ${error.message}, ${error.stackTrace}`,
                        );
                        this.stop(1);
                    }
                }),
            );
            this.logger.info('Routers initialized successfully');
        } catch (error) {
            this.logger.error(
                `Failed to initialize routers: ${error.message}, ${error.stackTrace}`,
            );
            this.stop(1);
        }
    }

    async createProfiles() {
        const blockchainModuleManager = this.container.resolve('blockchainModuleManager');
        const createProfilesPromises = blockchainModuleManager
            .getImplementationNames()
            .map(async (blockchain) => {
                try {
                    if (!(await blockchainModuleManager.identityIdExists(blockchain))) {
                        this.logger.info(`Creating profile on network: ${blockchain}`);
                        const networkModuleManager = this.container.resolve('networkModuleManager');
                        const peerId = networkModuleManager.getPeerId().toB58String();
                        await blockchainModuleManager.createProfile(blockchain, peerId);

                        if (
                            process.env.NODE_ENV === 'development' ||
                            process.env.NODE_ENV === 'test'
                        ) {
                            const blockchainConfig =
                                blockchainModuleManager.getModuleConfiguration(blockchain);
                            execSync(
                                `npm run set-stake -- --rpcEndpoint=${blockchainConfig.rpcEndpoints[0]} --stake=${blockchainConfig.initialStakeAmount} --operationalWalletPrivateKey=${blockchainConfig.evmOperationalWalletPrivateKey} --managementWalletPrivateKey=${blockchainConfig.evmManagementWalletPrivateKey} --hubContractAddress=${blockchainConfig.hubContractAddress}`,
                                { stdio: 'inherit' },
                            );
                            execSync(
                                `npm run set-ask -- --rpcEndpoint=${
                                    blockchainConfig.rpcEndpoints[0]
                                } --ask=${
                                    blockchainConfig.initialAskAmount +
                                    (Math.random() - 0.5) * blockchainConfig.initialAskAmount
                                } --privateKey=${
                                    blockchainConfig.evmOperationalWalletPrivateKey
                                } --hubContractAddress=${blockchainConfig.hubContractAddress}`,
                                { stdio: 'inherit' },
                            );
                        }
                    }
                    const identityId = await blockchainModuleManager.getIdentityId(blockchain);
                    this.logger.info(`Identity ID: ${identityId}`);
                } catch (error) {
                    this.logger.warn(
                        `Unable to create ${blockchain} blockchain profile. Removing implementation. Error: ${error.message}`,
                    );
                    blockchainModuleManager.removeImplementation(blockchain);
                }
            });

        await Promise.all(createProfilesPromises);

        if (!blockchainModuleManager.getImplementationNames().length) {
            this.logger.error(`Unable to create blockchain profiles. OT-node shutting down...`);
            this.stop(1);
        }
    }

    async initializeCommandExecutor() {
        try {
            const commandExecutor = this.container.resolve('commandExecutor');
            commandExecutor.pauseQueue();
            await commandExecutor.addDefaultCommands();
            commandExecutor
                .replayOldCommands()
                .then(() => this.logger.info('Finished replaying old commands'));
        } catch (e) {
            this.logger.error(
                `Command executor initialization failed. Error message: ${e.message}`,
            );
            this.stop(1);
        }
    }

    resumeCommandExecutor() {
        try {
            const commandExecutor = this.container.resolve('commandExecutor');
            commandExecutor.resumeQueue();
        } catch (e) {
            this.logger.error(
                `Unable to resume command executor queue. Error message: ${e.message}`,
            );
            this.stop(1);
        }
    }

    async startNetworkModule() {
        const networkModuleManager = this.container.resolve('networkModuleManager');
        await networkModuleManager.start();
    }

    startTelemetryModule() {
        const telemetryModuleManager = this.container.resolve('telemetryModuleManager');
        const repositoryModuleManager = this.container.resolve('repositoryModuleManager');
        telemetryModuleManager.listenOnEvents((eventData) => {
            repositoryModuleManager.createEventRecord(
                eventData.operationId,
                eventData.lastEvent,
                eventData.timestamp,
                eventData.value1,
                eventData.value2,
                eventData.value3,
            );
        });
    }

    async executePrivateAssetsMetadataMigration() {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;
        const blockchainModuleManager = this.container.resolve('blockchainModuleManager');
        const tripleStoreService = this.container.resolve('tripleStoreService');
        const serviceAgreementService = this.container.resolve('serviceAgreementService');
        const ualService = this.container.resolve('ualService');
        const dataService = this.container.resolve('dataService');

        const migration = new PrivateAssetsMetadataMigration(
            'privateAssetsMetadataMigration',
            this.logger,
            this.config,
            tripleStoreService,
            blockchainModuleManager,
            serviceAgreementService,
            ualService,
            dataService,
        );

        if (!(await migration.migrationAlreadyExecuted())) {
            await migration.migrate();
            this.logger.info('Node will now restart!');
            this.stop(1);
        }
    }

    async executeTelemetryModuleUserConfigurationMigration() {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const migration = new TelemetryModuleUserConfigurationMigration(
            'telemetryModuleUserConfigurationMigration',
            this.logger,
            this.config,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            await migration.migrate();
            this.logger.info('Node will now restart!');
            this.stop(1);
        }
    }

    async executeTripleStoreUserConfigurationMigration() {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const migration = new TripleStoreUserConfigurationMigration(
            'tripleStoreUserConfigurationMigration',
            this.logger,
            this.config,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            await migration.migrate();
            this.logger.info('Node will now restart!');
            this.stop(1);
        }
    }

    async executePullShardingTableMigration() {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const blockchainModuleManager = this.container.resolve('blockchainModuleManager');
        const repositoryModuleManager = this.container.resolve('repositoryModuleManager');
        const validationModuleManager = this.container.resolve('validationModuleManager');

        const migration = new PullBlockchainShardingTableMigration(
            'pullShardingTableMigrationV612',
            this.logger,
            this.config,
            repositoryModuleManager,
            blockchainModuleManager,
            validationModuleManager,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            await migration.migrate();
        }
    }

    async executeServiceAgreementsMetadataMigration() {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const blockchainModuleManager = this.container.resolve('blockchainModuleManager');
        const repositoryModuleManager = this.container.resolve('repositoryModuleManager');
        const tripleStoreService = this.container.resolve('tripleStoreService');
        const serviceAgreementService = this.container.resolve('serviceAgreementService');
        const ualService = this.container.resolve('ualService');

        const migration = new ServiceAgreementsMetadataMigration(
            'serviceAgreementsMetadataMigration',
            this.logger,
            this.config,
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

    async executeRemoveAgreementStartEndTimeMigration() {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const tripleStoreService = this.container.resolve('tripleStoreService');

        const migration = new RemoveAgreementStartEndTimeMigration(
            'removeAgreementStartEndTimeMigration',
            this.logger,
            this.config,
            tripleStoreService,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            await migration.migrate();
        }
    }

    async executeTripleStoreMetadataMigration() {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;
        const blockchainModuleManager = this.container.resolve('blockchainModuleManager');
        const tripleStoreService = this.container.resolve('tripleStoreService');
        const serviceAgreementService = this.container.resolve('serviceAgreementService');
        const ualService = this.container.resolve('ualService');
        const dataService = this.container.resolve('dataService');

        const migration = new TripleStoreMetadataMigration(
            'tripleStoreMetadataMigration',
            this.logger,
            this.config,
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

    async executeRemoveOldEpochCommandsMigration() {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const repositoryModuleManager = this.container.resolve('repositoryModuleManager');

        const migration = new RemoveOldEpochCommandsMigration(
            'removeOldEpochCommandsMigration',
            this.logger,
            this.config,
            repositoryModuleManager,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            await migration.migrate();
        }
    }

    async executePendingStorageMigration() {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const migration = new PendingStorageMigration(
            'pendingStorageMigration',
            this.logger,
            this.config,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            await migration.migrate();
        }
    }

    async initializeShardingTableService() {
        try {
            const shardingTableService = this.container.resolve('shardingTableService');
            await shardingTableService.initialize();
            this.logger.info('Sharding Table Service initialized successfully');
        } catch (error) {
            this.logger.error(
                `Unable to initialize sharding table service. Error message: ${error.message} OT-node shutting down...`,
            );
            this.stop(1);
        }
    }

    async removeUpdateFile() {
        const updateFilePath = this.fileService.getUpdateFilePath();
        await this.fileService.removeFile(updateFilePath).catch((error) => {
            this.logger.warn(`Unable to remove update file. Error: ${error}`);
        });
        this.config.otNodeUpdated = true;
    }

    async checkForUpdate() {
        const autoUpdaterCommand = new OtnodeUpdateCommand({
            logger: this.logger,
            config: this.config,
            fileService: this.fileService,
            autoUpdaterModuleManager: this.autoUpdaterModuleManager,
        });

        await autoUpdaterCommand.execute();
    }

    stop(code = 0) {
        this.logger.info('Stopping node...');
        process.exit(code);
    }

    async executeMarkOldBlockchainEventsAsProcessedMigration() {
        if (
            process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
            process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST
        )
            return;

        const repositoryModuleManager = this.container.resolve('repositoryModuleManager');

        const migration = new MarkOldBlockchainEventsAsProcessedMigration(
            'markOldBlockchainEventsAsProcessedMigration',
            this.logger,
            this.config,
            repositoryModuleManager,
        );
        if (!(await migration.migrationAlreadyExecuted())) {
            await migration.migrate();
        }
    }
}

export default OTNode;
