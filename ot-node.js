const DeepExtend = require('deep-extend');
const rc = require('rc');
const fs = require('fs');
const queue = require('fastq');
const appRootPath = require('app-root-path');
const path = require('path');
const EventEmitter = require('events');
const DependencyInjection = require('./src/service/dependency-injection');
const Logger = require('./modules/logger/logger');
const constants = require('./src/constants/constants');
const pjson = require('./package.json');
const configjson = require('./config/config.json');
const M1FolderStructureInitialMigration = require('./modules/migration/m1-folder-structure-initial-migration');
const FileService = require('./src/service/file-service');

class OTNode {
    constructor(config) {
        this.initializeConfiguration(config);
        this.logger = new Logger(this.config.logLevel, this.config.telemetryHub.enabled);
        this.checkNodeVersion();
    }

    async start() {
        await this.removeUpdateFile();
        await this.runFolderStructureInitialMigration();

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

        this.initializeDependencyContainer();
        this.initializeEventEmitter();

        await this.initializeModules();
        await this.createProfiles();
        await this.saveNetworkModulePeerIdAndPrivKey();

        await this.initializeControllers();
        await this.initializeCommandExecutor();
        await this.initializeTelemetryInjectionService();

        this.logger.info('Node is up and running!');
    }

    checkNodeVersion() {
        const nodeMajorVersion = process.versions.node.split('.')[0];
        this.logger.warn('======================================================');
        this.logger.warn(`Using node.js version: ${process.versions.node}`);
        if (nodeMajorVersion < constants.MIN_NODE_VERSION) {
            this.logger.warn(
                `This node was tested with node.js version 16. To make sure that your node is running properly please update your node version!`,
            );
        }
        this.logger.warn('======================================================');
    }

    async runFolderStructureInitialMigration() {
        const m1FolderStructureInitialMigration = new M1FolderStructureInitialMigration(
            this.logger,
            this.config,
        );
        return m1FolderStructureInitialMigration.run();
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
        const fileService = new FileService({ config: this.config });
        const updateFilePath = fileService.getUpdateFilePath();
        if (fs.existsSync(updateFilePath)) {
            this.config.otNodeUpdated = true;
            fileService.removeFile(updateFilePath).catch((error) => {
                this.logger.warn(`Unable to remove update file. Error: ${error}`);
            });
        }
    }

    initializeDependencyContainer() {
        this.container = DependencyInjection.initialize();
        DependencyInjection.registerValue(this.container, 'config', this.config);
        DependencyInjection.registerValue(this.container, 'logger', this.logger);
        DependencyInjection.registerValue(this.container, 'constants', constants);
        DependencyInjection.registerValue(this.container, 'blockchainQueue', queue);
        DependencyInjection.registerValue(this.container, 'tripleStoreQueue', queue);

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
            process.exit(1);
        }
    }

    initializeEventEmitter() {
        const eventEmitter = new EventEmitter();
        DependencyInjection.registerValue(this.container, 'eventEmitter', eventEmitter);

        this.logger.info('Event emitter initialized');
    }

    async initializeControllers() {
        try {
            this.logger.info('Initializing http api router');
            const httpApiRouter = this.container.resolve('httpApiRouter');
            await httpApiRouter.initialize();
        } catch (e) {
            this.logger.error(`Http api router initialization failed. Error message: ${e.message}`);
        }

        try {
            this.logger.info('Initializing rpc router');
            const rpcRouter = this.container.resolve('rpcRouter');
            await rpcRouter.initialize();
        } catch (e) {
            this.logger.error(`RPC router initialization failed. Error message: ${e.message}`);
        }
    }

    async createProfiles() {
        const blockchainModuleManager = this.container.resolve('blockchainModuleManager');
        const createProfilesPromises = blockchainModuleManager
            .getImplementationsNames()
            .map(async (blockchain) => {
                try {
                    if (!blockchainModuleManager.identityExists(blockchain)) {
                        const networkModuleManager = this.container.resolve('networkModuleManager');
                        const peerId = networkModuleManager.getPeerId();
                        await blockchainModuleManager.deployIdentity(blockchain);
                        await blockchainModuleManager.createProfile(blockchain, peerId);
                        if (
                            process.env.NODE_ENV !== 'development' &&
                            process.env.NODE_ENV !== 'test'
                        ) {
                            this.saveIdentityInUserConfigurationFile(
                                blockchainModuleManager.getIdentity(blockchain),
                                blockchain,
                            );
                        }
                    }
                    this.logger.info(
                        `${blockchain} blockchain identity is ${blockchainModuleManager.getIdentity(
                            blockchain,
                        )}`,
                    );
                } catch (error) {
                    this.logger.warn(
                        `Unable to create ${blockchain} blockchain profile. Removing implementation.`,
                    );
                    blockchainModuleManager.removeImplementation(blockchain);
                }
            });

        await Promise.all(createProfilesPromises);

        if (!blockchainModuleManager.getImplementationsNames().length) {
            this.logger.info(`Unable to create blockchain profiles. OT-node shutting down...`);
            process.exit(1);
        }
    }

    async saveNetworkModulePeerIdAndPrivKey() {
        const networkModuleManager = this.container.resolve('networkModuleManager');
        const privateKey = networkModuleManager.getPrivateKey();

        if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
            this.savePrivateKeyAndPeerIdInUserConfigurationFile(privateKey);
        }
    }

    async initializeCommandExecutor() {
        try {
            const commandExecutor = this.container.resolve('commandExecutor');
            await commandExecutor.init();
            commandExecutor.replay();
            await commandExecutor.start();
        } catch (e) {
            this.logger.error(
                `Command executor initialization failed. Error message: ${e.message}`,
            );
        }
    }

    async initializeTelemetryInjectionService() {
        try {
            const telemetryHubModuleManager = this.container.resolve('telemetryInjectionService');
            telemetryHubModuleManager.initialize();
            this.logger.info('Telemetry Injection Service initialized successfully');
        } catch (e) {
            this.logger.error(
                `Telemetry hub module initialization failed. Error message: ${e.message}`,
            );
        }
    }

    async initializeWatchdog() {
        try {
            const watchdogService = this.container.resolve('watchdogService');
            await watchdogService.initialize();
            this.logger.info('Watchdog service initialized');
        } catch (e) {
            this.logger.warn(`Watchdog service initialization failed. Error message: ${e.message}`);
        }
    }

    savePrivateKeyAndPeerIdInUserConfigurationFile(privateKey) {
        const configurationFilePath = path.join(appRootPath.path, '..', this.config.configFilename);
        const configFile = JSON.parse(fs.readFileSync(configurationFilePath));
        if (
            configFile.modules.network &&
            configFile.modules.network.implementation &&
            configFile.modules.network.implementation['libp2p-service'] &&
            configFile.modules.network.implementation['libp2p-service'].config
        ) {
            if (!configFile.modules.network.implementation['libp2p-service'].config.privateKey) {
                configFile.modules.network.implementation['libp2p-service'].config.privateKey =
                    privateKey;
                fs.writeFileSync(configurationFilePath, JSON.stringify(configFile, null, 2));
            }
        }
    }

    saveIdentityInUserConfigurationFile(identity, blockchain) {
        const configurationFilePath = path.join(appRootPath.path, '..', this.config.configFilename);
        const configFile = JSON.parse(fs.readFileSync(configurationFilePath));
        if (
            configFile.modules.blockchain &&
            configFile.modules.blockchain.implementation &&
            configFile.modules.blockchain.implementation[blockchain] &&
            configFile.modules.blockchain.implementation[blockchain].config
        ) {
            if (!configFile.modules.blockchain.implementation[blockchain].config.identity) {
                configFile.modules.blockchain.implementation[blockchain].config.identity = identity;
                fs.writeFileSync(configurationFilePath, JSON.stringify(configFile, null, 2));
            }
        }
    }

    async removeUpdateFile() {
        const fileService = new FileService({ config: this.config, logger: this.logger });
        const updateFilePath = fileService.getUpdateFilePath();
        if (fs.existsSync(updateFilePath)) {
            this.config.otNodeUpdated = true;
            await fileService.removeFile(updateFilePath).catch((error) => {
                this.logger.warn(`Unable to remove update file. Error: ${error}`);
            });
        }
    }

    stop() {
        this.logger.info('Stopping node...');
        process.exit(0);
    }
}

module.exports = OTNode;
