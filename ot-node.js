const DeepExtend = require('deep-extend');
const rc = require('rc');
const fs = require('fs');
const queue = require('fastq');
const appRootPath = require('app-root-path');
const path = require('path');
const DependencyInjection = require('./src/service/dependency-injection');
const Logger = require('./modules/logger/logger');
const constants = require('./modules/constants');
const pjson = require('./package.json');
const configjson = require('./config/config.json');
const M1FolderStructureInitialMigration = require('./modules/migration/m1-folder-structure-initial-migration');
const FileService = require('./modules/service/file-service');

class OTNode {
    constructor(config) {
        this.initializeConfiguration(config);
        this.logger = new Logger(this.config.logLevel, this.config.telemetryHub.enabled);
    }

    async start() {
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
        await this.initializeModules();
        await this.saveNetworkModulePeerIdAndPrivKey();

        await this.initializeControllers();
        await this.initializeCommandExecutor();
        await this.initializeTelemetryHubModule();

        this.logger.info('Node is up and running!');
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
            this.logger.error({
                msg: `Module initialization failed. Error message: ${e.message}`,
                Event_name: constants.ERROR_TYPE.MODULE_INITIALIZATION_ERROR,
            });
            process.exit(1);
        }
    }

    async initializeControllers() {
        try {
            this.logger.info('Initializing http api router');
            const httpApiRouter = this.container.resolve('httpApiRouter');
            await httpApiRouter.initialize();
        } catch (e) {
            this.logger.error({
                msg: `Http api router initialization failed. Error message: ${e.message}`,
                Event_name: constants.ERROR_TYPE.RPC_INITIALIZATION_ERROR,
            });
        }

        try {
            this.logger.info('Initializing rpc router');
            const rpcRouter = this.container.resolve('rpcRouter');
            await rpcRouter.initialize();
        } catch (e) {
            this.logger.error({
                msg: `RPC router initialization failed. Error message: ${e.message}`,
                Event_name: constants.ERROR_TYPE.RPC_INITIALIZATION_ERROR,
            });
        }
    }

    async saveNetworkModulePeerIdAndPrivKey() {
        const networkModuleManager = this.container.resolve('networkModuleManager');
        const peerId = networkModuleManager.getPeerId();
        const privateKey = networkModuleManager.getPrivateKey();

        this.config.network.peerId = peerId;
        if (!this.config.network.privateKey && this.config.network.privateKey !== privateKey) {
            this.config.network.privateKey = privateKey;
            if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
                this.savePrivateKeyInUserConfigurationFile(privateKey);
            }
        }
    }

    async initializeCommandExecutor() {
        try {
            const commandExecutor = this.container.resolve('commandExecutor');
            await commandExecutor.init();
            commandExecutor.replay();
            await commandExecutor.start();
        } catch (e) {
            this.logger.error({
                msg: `Command executor initialization failed. Error message: ${e.message}`,
                Event_name: constants.ERROR_TYPE.COMMAND_EXECUTOR_INITIALIZATION_ERROR,
            });
        }
    }

    async initializeTelemetryHubModule() {
        try {
            const telemetryHubModuleManager = this.container.resolve('telemetryHubModuleManager');
            if (telemetryHubModuleManager.initialize(this.config.telemetryHub, this.logger)) {
                this.logger.info(
                    `Telemetry hub module initialized successfully, using ${telemetryHubModuleManager.config.telemetryHub.packages} package(s)`,
                );
            }
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

    savePrivateKeyInUserConfigurationFile(privateKey) {
        const configurationFilePath = path.join(appRootPath.path, '..', this.config.configFilename);
        const configFile = JSON.parse(fs.readFileSync(configurationFilePath));
        configFile.network.privateKey = privateKey;
        fs.writeFileSync(configurationFilePath, JSON.stringify(configFile, null, 2));
    }

    stop() {
        this.logger.info('Stopping node...');
        process.exit(0);
    }
}

module.exports = OTNode;
