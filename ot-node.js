if (!process.env.NODE_ENV) {
    // Environment not set. Use the development.
    process.env.NODE_ENV = 'development';
}
const { execSync } = require('child_process');
const DeepExtend = require('deep-extend');
const AutoGitUpdate = require('auto-git-update');
const rc = require('rc');
const DependencyInjection = require('./modules/service/dependency-injection');
const Logger = require('./modules/logger/logger');
const constants = require('./modules/constants');
const db = require('./models');
const pjson = require('./package.json');
const defaultConfiguration = require('./config/config.json')[process.env.NODE_ENV];

class OTNode {
    constructor(config) {
        this.config = config;
        this.logger = new Logger(this.config.logLevel, this.config.telemetryHub.enabled);
    }

    async start() {
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
        await this.initializeAutoUpdate();
        await this.initializeDataModule();
        await this.initializeValidationModule();
        await this.initializeBlockchainModule();
        await this.initializeNetworkModule();
        await this.initializeCommandExecutor();
        await this.initializeRpcModule();
        // await this.initializeWatchdog();
    }

    initializeConfiguration(userConfig) {
        if (userConfig) {
            this.config = DeepExtend(defaultConfiguration, userConfig);
        } else {
            this.config = rc(pjson.name, defaultConfiguration);
        }
    }

    initializeDependencyContainer() {
        this.container = DependencyInjection.initialize();
        DependencyInjection.registerValue(this.container, 'config', this.config);
        DependencyInjection.registerValue(this.container, 'logger', this.logger);
        DependencyInjection.registerValue(this.container, 'constants', constants);

        this.logger.info('Dependency injection module is initialized');
    }

    async initializeAutoUpdate() {
        try {
            if (!this.config.autoUpdate.enabled) {
                return;
            }

            const autoUpdateConfig = {
                repository: 'https://github.com/OriginTrail/ot-node',
                branch: this.config.autoUpdate.branch,
                tempLocation: this.config.autoUpdate.backupDirectory,
                executeOnComplete: 'npx sequelize --config=./config/sequelizeConfig.js db:migrate',
                exitOnComplete: true,
            };

            execSync(`mkdir -p ${this.config.autoUpdate.backupDirectory}`);

            this.updater = new AutoGitUpdate(autoUpdateConfig);
            this.updater.setLogConfig({
                logGeneral: false,
            });
            DependencyInjection.registerValue(this.container, 'updater', this.updater);

            this.logger.info('Auto update mechanism initialized');
        } catch (e) {
            this.logger.error({
                msg: `Auto update initialization failed. Error message: ${e.message}`,
                Event_name: 'UpdateInitializationError',
            });
        }
    }

    async initializeDataModule() {
        try {
            const dataService = this.container.resolve('dataService');
            // if (!this.config.data) {
            //     this.logger.warn('Data module not initialized, no implementation is provided');
            // }

            await dataService.initialize();
            this.logger.info(`Data module: ${dataService.getName()} implementation`);
            db.sequelize.sync();
        } catch (e) {
            this.logger.error({
                msg: `Data module initialization failed. Error message: ${e.message}`,
                Event_name: 'DataModuleInitializationError',
            });
        }
    }

    async initializeNetworkModule() {
        try {
            const networkService = this.container.resolve('networkService');
            await networkService.initialize();
            const rankingService = this.container.resolve('rankingService');
            await rankingService.initialize();
            // if (!this.config.network) {
            //     this.logger.warn('Network modu
            //     le not initialized, no implementation is provided');
            // }
            // const rankingService = this.container.resolve('rankingService');
            // await rankingService.initialize(this.config.network.ranking);
            // await networkService.initialize(this.config.network.implementation, rankingService);
            this.logger.info(`Network module: ${networkService.getName()} implementation`);
        } catch (e) {
            this.logger.error({
                msg: `Network module initialization failed. Error message: ${e.message}`,
                Event_name: 'NetworkInitializationError',
            });
        }
    }

    async initializeValidationModule() {
        try {
            const validationService = this.container.resolve('validationService');
            // if (!this.config.validation) {
            //     this.logger.warn('Validation module not initialized, no implementation is provided');
            // }

            await validationService.initialize();
            this.logger.info(`Validation module: ${validationService.getName()} implementation`);
        } catch (e) {
            this.logger.error({
                msg: `Validation module initialization failed. Error message: ${e.message}`,
                Event_name: 'ValidationInitializationError',
            });
        }
    }

    async initializeBlockchainModule() {
        try {
            const blockchainService = this.container.resolve('blockchainService');
            // if (!this.config.blockchain) {
            //     this.logger.warn('Blockchain module not initialized, no implementation is provided.');
            // }

            await blockchainService.initialize();
            this.logger.info(`Blockchain module: ${blockchainService.getName()} implementation`);
        } catch (e) {
            this.logger.error({
                msg: `Blockchain module initialization failed. Error message: ${e.message}`,
                Event_name: 'BlockchainInitializationError',
            });
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
                Event_name: 'CommandExecutorInitializationError',
            });
        }
    }

    async initializeRpcModule() {
        try {
            const rpcController = this.container.resolve('rpcController');
            await rpcController.initialize();
        } catch (e) {
            this.logger.error({
                msg: `RPC service initialization failed. Error message: ${e.message}`,
                Event_name: 'RpcInitializationError',
            });
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

    stop() {
        this.logger.info('Stopping node...');
        process.exit(1);
    }
}

module.exports = OTNode;
