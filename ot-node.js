import DeepExtend from 'deep-extend';
import rc from 'rc';
import fs from 'fs';
import appRootPath from 'app-root-path';
import path from 'path';
import EventEmitter from 'events';
import { createRequire } from 'module';
import DependencyInjection from './src/service/dependency-injection.js';
import Logger from './src/logger/logger.js';
import { MIN_NODE_VERSION } from './src/constants/constants.js';
import FileService from './src/service/file-service.js';

const require = createRequire(import.meta.url);
const pjson = require('./package.json');
const configjson = require('./config/config.json');

class OTNode {
    constructor(config) {
        this.initializeConfiguration(config);
        this.logger = new Logger(this.config.logLevel, this.config.telemetry.enabled);
        this.checkNodeVersion();
    }

    async start() {
        await this.removeUpdateFile();

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
        await this.saveNetworkModulePeerIdAndPrivKey();
        await this.createProfiles();

        await this.initializeCommandExecutor();
        await this.initializeShardingTableService('ganache');
        await this.initializeTelemetryInjectionService();

        await this.initializeRouters();

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

    async initializeRouters() {
        try {
            this.logger.info('Initializing http api and rpc router');
            const httpApiRouter = this.container.resolve('httpApiRouter');
            const rpcRouter = this.container.resolve('rpcRouter');

            await Promise.all([
                httpApiRouter.initialize().catch((err) => {
                    this.logger.error(
                        `Http api router initialization failed. Error message: ${err.message}, ${err.stackTrace}`,
                    );
                    this.stop(1);
                }),
                rpcRouter.initialize().catch((err) => {
                    this.logger.error(
                        `RPC router initialization failed. Error message: ${err.message}, ${err.stackTrace}`,
                    );
                    this.stop(1);
                }),
            ]);
            this.logger.info('Routers initialized successfully');
        } catch (e) {
            this.logger.error(`Failed to initialize routers: ${e.message}, ${e.stackTrace}`);
            this.stop(1);
        }
    }

    async createProfiles() {
        const blockchainModuleManager = this.container.resolve('blockchainModuleManager');
        const createProfilesPromises = blockchainModuleManager
            .getImplementationsNames()
            .map(async (blockchain) => {
                try {
                    if (!blockchainModuleManager.identityExists(blockchain)) {
                        this.logger.info(`Creating blockchain identity on network: ${blockchain}`);
                        const networkModuleManager = this.container.resolve('networkModuleManager');
                        const peerId = networkModuleManager.getPeerId();
                        await blockchainModuleManager.deployIdentity(blockchain);
                        this.logger.info(`Creating profile on network: ${blockchain}`);
                        await blockchainModuleManager.createProfile(blockchain, peerId);
                        if (
                            process.env.NODE_ENV !== 'development' &&
                            process.env.NODE_ENV !== 'test'
                        ) {
                            await this.saveIdentityInUserConfigurationFile(
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
            this.stop(1);
        }
    }

    async saveNetworkModulePeerIdAndPrivKey() {
        const networkModuleManager = this.container.resolve('networkModuleManager');
        const privateKey = networkModuleManager.getPrivateKey();

        if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
            await this.savePrivateKeyAndPeerIdInUserConfigurationFile(privateKey);
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
            this.stop(1);
        }
    }

    async initializeShardingTableService(blockchain) {
        try {
            const shardingHubModuleManager = this.container.resolve('shardingTableService');
            await shardingHubModuleManager.initialize('ganache');
            this.logger.info(
                `Sharding Table Service initialized successfully for '${blockchain}' blockchain`,
            );
        } catch (e) {
            this.logger.error(
                `Sharding hub module initialization for '${blockchain}' blockchain failed.
                Error message: ${e.message}`,
            );
        }

        // const blockchainModuleManager = this.container.resolve('blockchainModuleManager');
        // const initShardingServices = blockchainModuleManager
        //     .getImplementationsNames()
        //     .map(async (blockchain) => {
        //         try {
        //             const shardingHubModuleManager = this.container.resolve('shardingTableService');
        //             shardingHubModuleManager.initialize(blockchain);
        //             this.logger.info(
        //                 `Sharding Table Service initialized successfully for '${blockchain}' blockchain`,
        //             );
        //         } catch (e) {
        //             this.logger.error(
        //                 `Sharding hub module initialization for '${blockchain}' blockchain failed.
        //                 Error message: ${e.message}`,
        //             );
        //         }
        //     });
        // await Promise.all(initShardingServices);
    }

    async initializeTelemetryInjectionService() {
        if (this.config.telemetry.enabled) {
            try {
                const telemetryHubModuleManager = this.container.resolve(
                    'telemetryInjectionService',
                );
                telemetryHubModuleManager.initialize();
                this.logger.info('Telemetry Injection Service initialized successfully');
            } catch (e) {
                this.logger.error(
                    `Telemetry hub module initialization failed. Error message: ${e.message}`,
                );
            }
        }
    }

    async savePrivateKeyAndPeerIdInUserConfigurationFile(privateKey) {
        const configurationFilePath = path.join(appRootPath.path, '..', this.config.configFilename);
        const configFile = JSON.parse(await fs.promises.readFile(configurationFilePath));

        if (!configFile.modules.network) {
            configFile.modules.network = {
                implementation: {
                    'libp2p-service': {
                        config: {},
                    },
                },
            };
        } else if (!configFile.modules.network.implementation) {
            configFile.modules.network.implementation = {
                'libp2p-service': {
                    config: {},
                },
            };
        } else if (!configFile.modules.network.implementation['libp2p-service']) {
            configFile.modules.network.implementation['libp2p-service'] = {
                config: {},
            };
        }
        if (!configFile.modules.network.implementation['libp2p-service'].config.privateKey) {
            configFile.modules.network.implementation['libp2p-service'].config.privateKey =
                privateKey;
            await fs.promises.writeFile(configurationFilePath, JSON.stringify(configFile, null, 2));
        }
    }

    async saveIdentityInUserConfigurationFile(identity, blockchain) {
        const configurationFilePath = path.join(appRootPath.path, '..', this.config.configFilename);
        const configFile = JSON.parse(await fs.promises.readFile(configurationFilePath));
        if (
            configFile.modules.blockchain &&
            configFile.modules.blockchain.implementation &&
            configFile.modules.blockchain.implementation[blockchain] &&
            configFile.modules.blockchain.implementation[blockchain].config
        ) {
            if (!configFile.modules.blockchain.implementation[blockchain].config.identity) {
                configFile.modules.blockchain.implementation[blockchain].config.identity = identity;
                await fs.promises.writeFile(
                    configurationFilePath,
                    JSON.stringify(configFile, null, 2),
                );
            }
        }
    }

    async removeUpdateFile() {
        const fileService = new FileService({ config: this.config, logger: this.logger });
        const updateFilePath = fileService.getUpdateFilePath();
        await fileService.removeFile(updateFilePath).catch((error) => {
            this.logger.warn(`Unable to remove update file. Error: ${error}`);
        });
        this.config.otNodeUpdated = true;
    }

    stop(code = 0) {
        this.logger.info('Stopping node...');
        process.exit(code);
    }
}

export default OTNode;
