import DeepExtend from 'deep-extend';
import rc from 'rc';
import EventEmitter from 'events';
import { createRequire } from 'module';
import { execSync } from 'child_process';
import crypto from 'crypto';
import DependencyInjection from './src/service/dependency-injection.js';
import Logger from './src/logger/logger.js';
import {
    MIN_NODE_VERSION,
    PARANET_ACCESS_POLICY,
    TRIPLE_STORE_REPOSITORIES,
} from './src/constants/constants.js';
import FileService from './src/service/file-service.js';
import OtnodeUpdateCommand from './src/commands/common/otnode-update-command.js';
import OtAutoUpdater from './src/modules/auto-updater/implementation/ot-auto-updater.js';
import MigrationExecutor from './src/migration/migration-executor.js';

const require = createRequire(import.meta.url);
const { setTimeout } = require('timers/promises');
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

        await MigrationExecutor.executeMultipleOpWalletsUserConfigurationMigration(
            this.container,
            this.logger,
            this.config,
        );

        this.logger.info('██████╗ ██╗  ██╗ ██████╗     ██╗   ██╗ █████╗ ');
        this.logger.info('██╔══██╗██║ ██╔╝██╔════╝     ██║   ██║██╔══██╗');
        this.logger.info('██║  ██║█████╔╝ ██║  ███╗    ██║   ██║╚█████╔╝');
        this.logger.info('██║  ██║██╔═██╗ ██║   ██║    ╚██╗ ██╔╝██╔══██╗');
        this.logger.info('██████╔╝██║  ██╗╚██████╔╝     ╚████╔╝ ╚█████╔╝');
        this.logger.info('╚═════╝ ╚═╝  ╚═╝ ╚═════╝       ╚═══╝   ╚════╝ ');

        this.logger.info('======================================================');
        this.logger.info(`             OriginTrail Node v${pjson.version}`);
        this.logger.info('======================================================');
        this.logger.info(`Node is running in ${process.env.NODE_ENV} environment`);

        await this.initializeDependencyContainer();
        this.initializeEventEmitter();

        await this.initializeModules();
        await this.initializeParanets();

        await MigrationExecutor.executeRemoveServiceAgreementsForChiadoMigration(
            this.container,
            this.logger,
            this.config,
        );

        await MigrationExecutor.executeDevnetPruningMigration(
            this.container,
            this.logger,
            this.config,
        );

        await this.createProfiles();

        await this.initializeCommandExecutor();
        await this.initializeShardingTableService();

        await MigrationExecutor.executeMarkStakingEventsAsProcessedMigration(
            this.container,
            this.logger,
            this.config,
        );

        await this.initializeBlockchainEventListenerService();

        await MigrationExecutor.executePullShardingTableMigration(
            this.container,
            this.logger,
            this.config,
        );

        await MigrationExecutor.executeServiceAgreementPruningMigration(
            this.container,
            this.logger,
            this.config,
        );

        await MigrationExecutor.executeDevnetNeuroPruningMigration(
            this.container,
            this.logger,
            this.config,
        );

        await this.initializeRouters();
        await this.startNetworkModule();
        this.startTelemetryModule();
        this.resumeCommandExecutor();
        this.logger.info('Node is up and running!');

        const implementation = 'ot-neptune';
        const repository = TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT;
        const tripleStoreModuleManager = this.container.resolve('tripleStoreModuleManager');

        this.logger.info('------------------------------------------------------');
        this.logger.info('------------------------------------------------------');
        this.logger.info('------------------------INSERT------------------------');

        const nquads = `
            <https://y.com/products/uk-bonds/datasets/10-year> <http://purl.org/dc/terms/conformsTo> <https://spec.edmcouncil.org/fibo/ontology/SEC/Debt/Bonds/CallableBond> .
            <https://y.com/products/uk-bonds/datasets/10-year> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/ns/dcat#Dataset> .
            <https://y.com/products/uk-bonds> <http://purl.org/dc/terms/description> "UK Bonds is your one-stop-shop for all your bonds!" .
            <https://y.com/products/uk-bonds> <http://purl.org/dc/terms/title> "UK Bonds" .
            <https://y.com/products/uk-bonds> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://ekgf.github.io/dprod/DataProduct> .
            <https://y.com/products/uk-bonds> <https://ekgf.github.io/dprod/dataProductOwner> <https://www.linkedin.com/in/tonyseale/> .
            <https://y.com/products/uk-bonds> <https://ekgf.github.io/dprod/lifecycleStatus> <https://ekgf.github.io/dprod/data/lifecycle-status/Consume> .
            <https://y.com/products/uk-bonds> <https://ekgf.github.io/dprod/outputPort> _:b0 .
            _:b0 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/ns/dcat#DataService> .
            _:b0 <http://www.w3.org/ns/dcat#endpointURL> "https://y.com/uk-10-year-bonds" .
            _:b0 <https://ekgf.github.io/dprod/isAccessServiceOf> _:b1 .
            _:b1 <http://purl.org/dc/terms/format> "https://www.iana.org/assignments/media-types/application/json" .
            _:b1 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/ns/dcat#Distribution> .
            _:b1 <https://ekgf.github.io/dprod/isDistributionOf> <https://y.com/products/uk-bonds/datasets/10-year> .
        `;

        const assertionId = crypto.randomBytes(32).toString('hex');
        const insertResult = await tripleStoreModuleManager.insertAssertion(
            implementation,
            repository,
            assertionId,
            nquads,
        );
        console.log('Response Data:', JSON.stringify(insertResult, null, 4));

        this.logger.info('------------------------------------------------------');
        this.logger.info('------------------------------------------------------');
        this.logger.info('------------------------SELECT------------------------');

        const query =
            'SELECT ?p ?o WHERE {?s <https://ekgf.github.io/dprod/title> "UK Bonds" . ?s ?p ?o . }';
        const selectResult = await tripleStoreModuleManager.select(
            implementation,
            repository,
            query,
        );
        console.log('Response Data:', JSON.stringify(selectResult, null, 4));

        this.logger.info('------------------------------------------------------');
        this.logger.info('------------------------------------------------------');
        this.logger.info('------------------------------------------------------');

        MigrationExecutor.executeGetOldServiceAgreementsMigration(
            this.container,
            this.logger,
            this.config,
        );

        MigrationExecutor.executeServiceAgreementPruningMigration(
            this.container,
            this.logger,
            this.config,
        );

        MigrationExecutor.executeRemoveDuplicateServiceAgreementMigration(
            this.container,
            this.logger,
            this.config,
        );
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
                                `npm run set-stake -- --rpcEndpoint=${blockchainConfig.rpcEndpoints[0]} --stake=${blockchainConfig.initialStakeAmount} --operationalWalletPrivateKey=${blockchainConfig.operationalWallets[0].privateKey} --managementWalletPrivateKey=${blockchainConfig.evmManagementWalletPrivateKey} --hubContractAddress=${blockchainConfig.hubContractAddress}`,
                                { stdio: 'inherit' },
                            );
                            await setTimeout(10000);
                            execSync(
                                `npm run set-ask -- --rpcEndpoint=${
                                    blockchainConfig.rpcEndpoints[0]
                                } --ask=${
                                    blockchainConfig.initialAskAmount +
                                    (Math.random() - 0.5) * blockchainConfig.initialAskAmount
                                } --privateKey=${
                                    blockchainConfig.operationalWallets[0].privateKey
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
                eventData.blockchainId,
                eventData.lastEvent,
                eventData.timestamp,
                eventData.value1,
                eventData.value2,
                eventData.value3,
            );
        });
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

    // TODO: add validation for node being a part of paranet
    async initializeParanets() {
        const blockchainModuleManager = this.container.resolve('blockchainModuleManager');
        const tripleStoreService = this.container.resolve('tripleStoreService');
        const tripleStoreModuleManager = this.container.resolve('tripleStoreModuleManager');
        const paranetService = this.container.resolve('paranetService');
        const ualService = this.container.resolve('ualService');
        const validParanets = [];

        // eslint-disable-next-line no-unsafe-optional-chaining
        for (const paranetUAL of this.config.assetSync?.syncParanets) {
            if (!ualService.isUAL(paranetUAL)) {
                this.logger.warn(
                    `Unable to initialize Paranet with id ${paranetUAL} because of invalid UAL format`,
                );
                continue;
            }

            const { blockchain, contract, tokenId } = ualService.resolveUAL(paranetUAL);
            if (!blockchainModuleManager.getImplementationNames().includes(blockchain)) {
                this.logger.warn(
                    `Unable to initialize Paranet with id ${paranetUAL} because of unsupported blockchain implementation`,
                );
                continue;
            }

            const paranetId = paranetService.constructParanetId(blockchain, contract, tokenId);
            // eslint-disable-next-line no-await-in-loop
            const paranetExists = await blockchainModuleManager.paranetExists(
                blockchain,
                paranetId,
            );
            if (!paranetExists) {
                this.logger.warn(
                    `Unable to initialize Paranet with id ${paranetUAL} because it doesn't exist`,
                );
                continue;
            }

            // eslint-disable-next-line no-await-in-loop
            const nodesAccessPolicy = await blockchainModuleManager.getNodesAccessPolicy(
                blockchain,
                paranetId,
            );
            if (nodesAccessPolicy === PARANET_ACCESS_POLICY.CURATED) {
                // eslint-disable-next-line no-await-in-loop
                const identityId = await blockchainModuleManager.getIdentityId(blockchain);
                // eslint-disable-next-line no-await-in-loop
                const isCuratedNode = await blockchainModuleManager.isCuratedNode(
                    blockchain,
                    paranetId,
                    identityId,
                );
                if (!isCuratedNode) {
                    this.logger.warn(
                        `Unable to initialize Paranet with id ${paranetUAL} because node with id ${identityId} is not a curated node`,
                    );
                    continue;
                }
            }

            validParanets.push(paranetUAL);
            const repository = paranetService.getParanetRepositoryName(paranetUAL);
            // eslint-disable-next-line no-await-in-loop
            await tripleStoreModuleManager.initializeParanetRepository(repository);
            // eslint-disable-next-line no-await-in-loop
            await paranetService.initializeParanetRecord(blockchain, paranetId);
        }
        const repository = paranetService.getParanetRepositoryName(
            'did:dkg:hardhat1:31337/0x8aafc28174bb6c3bdc7be92f18c2f134e876c05e/7',
        );
        await tripleStoreModuleManager.initializeParanetRepository(repository);
        this.config.assetSync.syncParanets = validParanets;
        tripleStoreService.initializeRepositories();
    }

    stop(code = 0) {
        this.logger.info('Stopping node...');
        process.exit(code);
    }
}

export default OTNode;
