const {execSync} = require('child_process');
const AutoGitUpdate = require('auto-git-update');
const pjson = require('./package.json');
const DependencyInjection = require('./modules/service/dependency-injection');
const Logger = require('./modules/logger/logger');
const constants = require('./modules/constants');
const db = require('./models');

class OTNode {
    constructor(config) {
        this.config = config;
        this.logger = new Logger(this.config.logLevel, this.config.telemetryHub.enabled);
    }

    async start() {
        this.initialize();
        this.container = this.initializeDependencyContainer();

        await this.initializeAutoUpdate();
        await this.initializeDataModule();
        await this.initializeValidationModule();
        await this.initializeBlockchainModule();
        await this.initializeNetworkModule();
        await this.initializeCommandExecutor();
        await this.initializeRpcModule();
        // await this.initializeWatchdog();
    }

    initialize() {
        this.logger.info(' ██████╗ ████████╗███╗   ██╗ ██████╗ ██████╗ ███████╗');
        this.logger.info('██╔═══██╗╚══██╔══╝████╗  ██║██╔═══██╗██╔══██╗██╔════╝');
        this.logger.info('██║   ██║   ██║   ██╔██╗ ██║██║   ██║██║  ██║█████╗');
        this.logger.info('██║   ██║   ██║   ██║╚██╗██║██║   ██║██║  ██║██╔══╝');
        this.logger.info('╚██████╔╝   ██║   ██║ ╚████║╚██████╔╝██████╔╝███████╗');
        this.logger.info(' ╚═════╝    ╚═╝   ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚══════╝');

        this.logger.info('======================================================');
        this.logger.info(`             OriginTrail Node v${pjson.version}`);
        this.logger.info('======================================================');
        this.logger.info(`Node is running in ${process.env.NODE_ENV &&
        ['development', 'testnet', 'mainnet'].indexOf(process.env.NODE_ENV) >= 0 ?
            process.env.NODE_ENV : 'development'} environment`);
    }

    initializeDependencyContainer() {
        const container = DependencyInjection.initialize();
        DependencyInjection.registerValue(container, 'config', this.config);
        DependencyInjection.registerValue(container, 'logger', this.logger);
        DependencyInjection.registerValue(container, 'constants', constants);

        this.logger.info('Dependency injection module is initialized');
        return container;
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
                Event_name: constants.ERROR_TYPE.UPDATE_INITIALIZATION_ERROR,
            });
        }
    }

    async initializeDataModule() {
        try {
            const dataService = this.container.resolve('dataService');
            if (!this.config.data) {
                this.logger.warn('Data module not initialized, no implementation is provided');
            }

            await dataService.initialize(this.config.data);
            this.logger.info(`Data module: ${this.config.data.getName()} implementation`);
            db.sequelize.sync();
        } catch (e) {
            this.logger.error({
                msg: `Data module initialization failed. Error message: ${e.message}`,
                Event_name: constants.ERROR_TYPE.DATA_MODULE_INITIALIZATION_ERROR,
            });
        }
    }

    async initializeNetworkModule() {
        try {
            const networkService = this.container.resolve('networkService');
            if (!this.config.network) {
                this.logger.warn('Network module not initialized, no implementation is provided');
            }
            const rankingService = this.container.resolve('rankingService');
            await rankingService.initialize(this.config.network.ranking);
            await networkService.initialize(this.config.network.implementation, rankingService);
            this.logger.info(`Network module: ${this.config.network.implementation.getName()} implementation`);
        } catch (e) {
            this.logger.error({
                msg: `Network module initialization failed. Error message: ${e.message}`,
                Event_name: constants.ERROR_TYPE.NETWORK_INITIALIZATION_ERROR,
            });
        }
    }

    async initializeValidationModule() {
        try {
            const validationService = this.container.resolve('validationService');
            if (!this.config.validation) {
                this.logger.warn('Validation module not initialized, no implementation is provided');
            }

            await validationService.initialize(this.config.validation);
            this.logger.info(`Validation module: ${this.config.validation.getName()} implementation`);
        } catch (e) {
            this.logger.error({
                msg: `Validation module initialization failed. Error message: ${e.message}`,
                Event_name: constants.ERROR_TYPE.VALIDATION_INITIALIZATION_ERROR,
            });
        }
    }

    async initializeBlockchainModule() {
        try {
            const blockchainService = this.container.resolve('blockchainService');
            if (!this.config.blockchain) {
                this.logger.warn('Blockchain module not initialized, no implementation is provided.');
            }

            await blockchainService.initialize(this.config.blockchain);
            this.logger.info(`Blockchain module: ${this.config.blockchain.getName()} implementation`);
        } catch (e) {
            this.logger.error({
                msg: `Blockchain module initialization failed. Error message: ${e.message}`,
                Event_name: constants.ERROR_TYPE.BLOCKCHAIN_INITIALIZATION_ERROR,
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
                Event_name: constants.ERROR_TYPE.COMMAND_EXECUTOR_INITIALIZATION_ERROR,
            });
        }
    }

    async initializeRpcModule() {
        try {
            const rpcController = this.container.resolve('rpcController');
            await rpcController.enable();
        } catch (e) {
            this.logger.error({
                msg: `RPC service initialization failed. Error message: ${e.message}`,
                Event_name: constants.ERROR_TYPE.RPC_INITIALIZATION_ERROR,
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
}

module.exports = OTNode;
