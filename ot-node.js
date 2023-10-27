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
import PrivateAssetsMetadataMigration from './src/migration/private-assets-metadata-migration.js';
import ServiceAgreementsMetadataMigration from './src/migration/service-agreements-metadata-migration.js';
import RemoveAgreementStartEndTimeMigration from './src/migration/remove-agreement-start-end-time-migration.js';
import MarkOldBlockchainEventsAsProcessedMigration from './src/migration/mark-old-blockchain-events-as-processed-migration.js';
import TripleStoreMetadataMigration from './src/migration/triple-store-metadata-migration.js';
import RemoveOldEpochCommandsMigration from './src/migration/remove-old-epoch-commands-migration.js';
import PendingStorageMigration from './src/migration/pending-storage-migration.js';

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

        await this.createProfiles();

        await this.initializeCommandExecutor();
        await this.initializeShardingTableService();
        await this.initializeTelemetryInjectionService();
        await this.initializeBlockchainEventListenerService();

        await this.initializeRouters();
        await this.startNetworkModule();
        this.resumeCommandExecutor();
        this.logger.info('Node is up and running!');
    }

    checkNodeVersion() {
        const nodeMajorVersion = process.versions.node.split('.')[0];
        this.logger.warn('======================================================');
        this.logger.warn(`Using node.js version: ${process.versions.node}`);
        if (nodeMajorVersion < MIN_NODE_VERSION) {
            this.logger.warn(
                `This node was tested with node.js version 16. ` +
                    `To make sure that your node is running properly please update your node version!`,
            );
        }
        this.logger.warn('======================================================');
    }

    initializeLogger() {
        this.logger = new Logger(this.config.logLevel);

        this.logger.info('Logger has been successfully initialized.');
    }

    initializeFileService() {
        this.fileService = new FileService({ config: this.config, logger: this.logger });

        this.logger.info('File Service has been successfully initialized.');
    }

    initializeAutoUpdaterModule() {
        this.autoUpdaterModuleManager = new OtAutoUpdater();
        this.autoUpdaterModuleManager.initialize(
            this.config.modules.autoUpdater.implementation['ot-auto-updater'].config,
            this.logger,
        );

        this.logger.info('Auto Updater has been successfully initialized.');
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

        this.logger.info('Dependency Injection Module has been successfully initialized.');
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
        } catch (e) {
            this.logger.error(
                `Module initialization failed. Error: ${e.message}. ` +
                    `OT-Node is shutting down...`,
            );
            this.stop(1);
        }

        this.logger.info(`All modules have been successfully initialized.`);
    }

    initializeEventEmitter() {
        const eventEmitter = new EventEmitter();
        DependencyInjection.registerValue(this.container, 'eventEmitter', eventEmitter);

        this.logger.info('Event Emitter has been successfully initialized.');
    }

    async initializeBlockchainEventListenerService() {
        try {
            const eventListenerService = this.container.resolve('blockchainEventListenerService');
            await eventListenerService.initialize();
            eventListenerService.startListeningOnEvents();
        } catch (error) {
            this.logger.error(
                `Unable to initialize Event Listener Service. Error: ${error.message}. ` +
                    `OT-Node is shutting down...`,
            );
            this.stop(1);
        }

        this.logger.info('Event Listener Service has been successfully initialized.');
    }

    async initializeRouters() {
        const routerNames = ['httpApiRouter', 'rpcRouter'];
        await Promise.all(
            routerNames.map(async (routerName) => {
                const router = this.container.resolve(routerName);
                try {
                    await router.initialize();
                } catch (error) {
                    this.logger.error(
                        `${routerName} initialization failed. Error: ${error.message}. ` +
                            `OT-Node is shutting down...`,
                    );
                    this.stop(1);
                }
            }),
        );

        this.logger.info('HTTP API and RPC Routers are successfully initialized.');
    }

    async createProfiles() {
        const blockchainModuleManager = this.container.resolve('blockchainModuleManager');
        const createProfilesPromises = blockchainModuleManager
            .getImplementationNames()
            .map(async (blockchain) => {
                try {
                    if (!(await blockchainModuleManager.identityIdExists(blockchain))) {
                        this.logger.info(`Creating profile on ${blockchain} network.`);
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
                    this.logger.info(`Identity ID: ${identityId}.`);
                } catch (error) {
                    this.logger.warn(
                        `Unable to create ${blockchain} blockchain profile. Error: ${error.message}. Removing implementation...`,
                    );
                    blockchainModuleManager.removeImplementation(blockchain);
                }
            });

        await Promise.all(createProfilesPromises);

        if (!blockchainModuleManager.getImplementationNames().length) {
            this.logger.error(`Unable to create blockchain profiles. OT-Node is shutting down...`);
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
                .then(() => this.logger.info('Finished replaying old commands.'));
        } catch (e) {
            this.logger.error(
                `Command executor initialization failed. Error: ${e.message}. ` +
                    `OT-Node is shutting down...`,
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

        this.logger.info('Network Module has been successfully started.');
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
        } catch (error) {
            this.logger.error(
                `Unable to initialize sharding table service. Error: ${error.message} ` +
                    `OT-Node is shutting down...`,
            );
            this.stop(1);
        }

        this.logger.info('Sharding Table Service has been successfully initialized.');
    }

    async initializeTelemetryInjectionService() {
        if (this.config.telemetry.enabled) {
            try {
                const telemetryHubModuleManager = this.container.resolve(
                    'telemetryInjectionService',
                );
                telemetryHubModuleManager.initialize();
            } catch (e) {
                this.logger.error(
                    `Telemetry hub module initialization failed. Error: ${e.message}`,
                );
            }

            this.logger.info('Telemetry Injection Service has been successfully initialized.');
        }
    }

    async removeUpdateFile() {
        const updateFilePath = this.fileService.getUpdateFilePath();
        await this.fileService.removeFile(updateFilePath).catch((error) => {
            this.logger.warn(`Unable to remove update file. Error: ${error}.`);
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
        this.logger.info('Stopping the node...');
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
