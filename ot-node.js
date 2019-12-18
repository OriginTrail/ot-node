require('dotenv').config();

if (!process.env.NODE_ENV) {
    // Environment not set. Use the production.
    process.env.NODE_ENV = 'testnet';
}

const HttpNetwork = require('./modules/network/http/http-network');
const Kademlia = require('./modules/network/kademlia/kademlia');
const Transport = require('./modules/network/transport');
const KademliaUtilities = require('./modules/network/kademlia/kademlia-utils');
const Utilities = require('./modules/Utilities');
const GraphStorage = require('./modules/Database/GraphStorage');
const Blockchain = require('./modules/Blockchain');
const BlockchainPluginService = require('./modules/Blockchain/plugin/blockchain-plugin-service');
const fs = require('fs');
const path = require('path');
const models = require('./models');
const Storage = require('./modules/Storage');
const SchemaValidator = require('./modules/validator/schema-validator');
const GS1Utilities = require('./modules/importer/gs1-utilities');
const WOTImporter = require('./modules/importer/wot-importer');
const EpcisOtJsonTranspiler = require('./modules/transpiler/epcis/epcis-otjson-transpiler');
const WotOtJsonTranspiler = require('./modules/transpiler/wot/wot-otjson-transpiler');
const RemoteControl = require('./modules/RemoteControl');
const bugsnag = require('bugsnag');
const rc = require('rc');
const uuidv4 = require('uuid/v4');
const awilix = require('awilix');
const homedir = require('os').homedir();
const argv = require('minimist')(process.argv.slice(2));
const Graph = require('./modules/Graph');
const Product = require('./modules/Product');

const EventEmitter = require('./modules/EventEmitter');
const DVService = require('./modules/DVService');
const MinerService = require('./modules/service/miner-service');
const ApprovalService = require('./modules/service/approval-service');
const ChallengeService = require('./modules/service/challenge-service');
const ProfileService = require('./modules/service/profile-service');
const ReplicationService = require('./modules/service/replication-service');
const APIUtilities = require('./modules/api-utilities');
const RestApiController = require('./modules/service/rest-api-controller');
const M1PayoutAllMigration = require('./modules/migration/m1-payout-all-migration');
const M2SequelizeMetaMigration = require('./modules/migration/m2-sequelize-meta-migration');
const M3NetowrkIdentityMigration = require('./modules/migration/m3-network-identity-migration');
const M4ArangoMigration = require('./modules/migration/m4-arango-migration');
const ImportWorkerController = require('./modules/worker/import-worker-controller');
const ImportService = require('./modules/service/import-service');

const { execSync } = require('child_process');
const semver = require('semver');

const pjson = require('./package.json');
const configjson = require('./config/config.json');

const Web3 = require('web3');

const log = require('./modules/logger');

global.__basedir = __dirname;

let context;
const defaultConfig = configjson[
    process.env.NODE_ENV &&
    ['development', 'testnet', 'mainnet'].indexOf(process.env.NODE_ENV) >= 0 ?
        process.env.NODE_ENV : 'development'];

let config;
try {
    // Load config.
    config = rc(pjson.name, defaultConfig);

    if (argv.configDir) {
        config.appDataPath = argv.configDir;
        models.sequelize.options.storage = path.join(config.appDataPath, 'system.db');
    } else {
        config.appDataPath = path.join(
            homedir,
            `.${pjson.name}rc`,
            process.env.NODE_ENV,
        );
    }

    if (!config.node_wallet || !config.node_private_key) {
        console.error('Please provide valid wallet.');
        process.abort();
    }

    if (!config.management_wallet) {
        console.error('Please provide a valid management wallet.');
        process.abort();
    }

    if (!config.blockchain.rpc_server_url) {
        console.error('Please provide a valid RPC server URL.');
        process.abort();
    }
} catch (error) {
    console.error(`Failed to read configuration. ${error}.`);
    console.error(error.stack);
    process.abort();
}

process.on('unhandledRejection', (reason, p) => {
    if (reason.message.startsWith('Invalid JSON RPC response')) {
        return;
    }
    log.error(`Unhandled Rejection:\n${reason.stack}`);

    if (process.env.NODE_ENV !== 'development') {
        const cleanConfig = Object.assign({}, config);
        delete cleanConfig.node_private_key;
        delete cleanConfig.houston_password;
        delete cleanConfig.database;
        delete cleanConfig.blockchain;

        bugsnag.notify(
            reason,
            {
                user: {
                    id: config.node_wallet,
                    identity: config.identity,
                    config: cleanConfig,
                },
                severity: 'error',
            },
        );
    }
});

process.on('uncaughtException', (err) => {
    if (process.env.NODE_ENV === 'development') {
        log.error(`Caught exception: ${err}.\n ${err.stack}`);
        process.exit(1);
    }
    log.error(`Caught exception: ${err}.\n ${err.stack}`);

    const cleanConfig = Object.assign({}, config);
    delete cleanConfig.node_private_key;
    delete cleanConfig.houston_password;
    delete cleanConfig.database;
    delete cleanConfig.blockchain;

    bugsnag.notify(
        err,
        {
            user: {
                id: config.node_wallet,
                identity: config.identity,
                config: cleanConfig,
            },
            severity: 'error',
        },
    );
});

process.on('warning', (warning) => {
    log.warn(warning.name);
    log.warn(warning.message);
    log.warn(warning.stack);
});

process.on('exit', (code) => {
    switch (code) {
    case 0:
        log.debug(`Normal exiting with code: ${code}`);
        break;
    case 4:
        log.trace('Exiting because of update.');
        break;
    default:
        log.error(`Whoops, terminating with code: ${code}`);
        break;
    }
});

process.on('SIGINT', () => {
    log.important('SIGINT caught. Exiting...');
    process.exit(0);
});

function notifyBugsnag(error, metadata, subsystem) {
    if (process.env.NODE_ENV !== 'development') {
        const cleanConfig = Object.assign({}, config);
        delete cleanConfig.node_private_key;
        delete cleanConfig.houston_password;
        delete cleanConfig.database;
        delete cleanConfig.blockchain;

        const options = {
            user: {
                id: config.node_wallet,
                identity: config.node_kademlia_id,
                config: cleanConfig,
            },
        };

        if (subsystem) {
            options.subsystem = {
                name: subsystem,
            };
        }

        if (metadata) {
            Object.assign(options, metadata);
        }

        bugsnag.notify(error, options);
    }
}

function notifyEvent(message, metadata, subsystem) {
    if (process.env.NODE_ENV !== 'development') {
        const cleanConfig = Object.assign({}, config);
        delete cleanConfig.node_private_key;
        delete cleanConfig.houston_password;
        delete cleanConfig.database;
        delete cleanConfig.blockchain;

        const options = {
            user: {
                id: config.node_wallet,
                identity: config.node_kademlia_id,
                config: cleanConfig,
            },
            severity: 'info',
        };

        if (subsystem) {
            options.subsystem = {
                name: subsystem,
            };
        }

        if (metadata) {
            Object.assign(options, metadata);
        }

        bugsnag.notify(message, options);
    }
}

/**
 * Main node object
 */
class OTNode {
    /**
     * OriginTrail node system bootstrap function
     */
    async bootstrap() {
        if (process.env.NODE_ENV !== 'development') {
            bugsnag.register(
                pjson.config.bugsnagkey,
                {
                    appVersion: pjson.version,
                    autoNotify: false,
                    sendCode: true,
                    releaseStage: config.bugSnag.releaseStage,
                    logger: {
                        info: log.info,
                        warn: log.warn,
                        error: log.error,
                    },
                    logLevel: 'error',
                },
            );
        }

        try {
            // check if all dependencies are installed
            await Utilities.checkInstalledDependencies();
            log.info('npm modules dependencies check done');

            // Checking root folder structure
            Utilities.checkOtNodeDirStructure();
            log.info('ot-node folder structure check done');
        } catch (err) {
            console.log(err);
            notifyBugsnag(err);
            process.exit(1);
        }

        log.important(`Running in ${process.env.NODE_ENV} environment.`);

        // sync models
        try {
            Storage.models = (await models.sequelize.sync()).models;
            Storage.db = models.sequelize;
        } catch (error) {
            if (error.constructor.name === 'ConnectionError') {
                console.error('Failed to open database. Did you forget to run "npm run setup"?');
                process.abort();
            }
            console.error(error);
            process.abort();
        }

        await this._runNetworkIdentityMigration(config);

        // Seal config in order to prevent adding properties.
        // Allow identity to be added. Continuity.
        config.identity = '';
        config.erc725Identity = '';
        Object.seal(config);

        const web3 =
            new Web3(new Web3.providers.HttpProvider(config.blockchain.rpc_server_url));

        const appState = {};
        if (config.is_bootstrap_node) {
            await this.startBootstrapNode({ appState }, web3);
            return;
        }

        // check if ArangoDB service is running at all
        if (config.database.provider === 'arangodb') {
            try {
                const { version } = await Utilities.getArangoDbVersion(config);

                log.info(`Arango server version ${version} is up and running`);
                if (semver.lt(version, '3.5.0')) {
                    if (process.env.OT_NODE_DISTRIBUTION === 'docker'
                        && config.autoUpdater.enabled) {
                        log.info('Your Arango version is lower than required. Starting upgrade...');
                        await this._runArangoMigration(config);

                        const { version } = await Utilities.getArangoDbVersion(config);
                        log.info(`Arango server is updated to version ${version}.`);
                    } else {
                        log.error('Arango version too old! Please update to version 3.5.0 or newer');
                        process.exit(1);
                    }
                }
            } catch (err) {
                log.error('Please make sure Arango server is up and running');
                console.log(err);
                notifyBugsnag(err);
                process.exit(1);
            }
        }

        // Checking if selected graph database exists
        try {
            await Utilities.checkDoesStorageDbExists(config);
            log.info('Storage database check done');
        } catch (err) {
            console.log(err);
            notifyBugsnag(err);
            process.exit(1);
        }

        // Create the container and set the injectionMode to PROXY (which is also the default).
        const container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });

        context = container.cradle;

        container.loadModules(['modules/command/**/*.js', 'modules/controller/**/*.js', 'modules/service/**/*.js', 'modules/Blockchain/plugin/hyperledger/*.js', 'modules/migration/*.js'], {
            formatName: 'camelCase',
            resolverOptions: {
                lifetime: awilix.Lifetime.SINGLETON,
                register: awilix.asClass,
            },
        });

        container.register({
            httpNetwork: awilix.asClass(HttpNetwork).singleton(),
            emitter: awilix.asClass(EventEmitter).singleton(),
            kademlia: awilix.asClass(Kademlia).singleton(),
            graph: awilix.asClass(Graph).singleton(),
            product: awilix.asClass(Product).singleton(),
            dvService: awilix.asClass(DVService).singleton(),
            profileService: awilix.asClass(ProfileService).singleton(),
            approvalService: awilix.asClass(ApprovalService).singleton(),
            config: awilix.asValue(config),
            appState: awilix.asValue(appState),
            web3: awilix.asValue(web3),
            schemaValidator: awilix.asClass(SchemaValidator).singleton(),
            blockchain: awilix.asClass(Blockchain).singleton(),
            blockchainPluginService: awilix.asClass(BlockchainPluginService).singleton(),
            gs1Utilities: awilix.asClass(GS1Utilities).singleton(),
            wotImporter: awilix.asClass(WOTImporter).singleton(),
            epcisOtJsonTranspiler: awilix.asClass(EpcisOtJsonTranspiler).singleton(),
            wotOtJsonTranspiler: awilix.asClass(WotOtJsonTranspiler).singleton(),
            graphStorage: awilix.asValue(new GraphStorage(config.database, log, notifyBugsnag)),
            remoteControl: awilix.asClass(RemoteControl).singleton(),
            logger: awilix.asValue(log),
            kademliaUtilities: awilix.asClass(KademliaUtilities).singleton(),
            notifyError: awilix.asFunction(() => notifyBugsnag).transient(),
            notifyEvent: awilix.asFunction(() => notifyEvent).transient(),
            transport: awilix.asValue(Transport()),
            apiUtilities: awilix.asClass(APIUtilities).singleton(),
            minerService: awilix.asClass(MinerService).singleton(),
            replicationService: awilix.asClass(ReplicationService).singleton(),
            restApiController: awilix.asClass(RestApiController).singleton(),
            challengeService: awilix.asClass(ChallengeService).singleton(),
            importWorkerController: awilix.asClass(ImportWorkerController).singleton(),
            importService: awilix.asClass(ImportService).singleton(),
        });
        const blockchain = container.resolve('blockchain');
        await blockchain.initialize();

        const emitter = container.resolve('emitter');
        const dhService = container.resolve('dhService');
        const remoteControl = container.resolve('remoteControl');
        const profileService = container.resolve('profileService');
        const approvalService = container.resolve('approvalService');
        await approvalService.initialize();

        emitter.initialize();

        // Connecting to graph database
        const graphStorage = container.resolve('graphStorage');
        try {
            await graphStorage.connect();
            log.info(`Connected to graph database: ${graphStorage.identify()}`);
            // TODO https://www.pivotaltracker.com/story/show/157873617
            // const myVersion = await graphStorage.version();
            // log.info(`Database version: ${myVersion}`);
        } catch (err) {
            log.error(`Failed to connect to the graph database: ${graphStorage.identify()}`);
            console.log(err);
            notifyBugsnag(err);
            process.exit(1);
        }

        // Fetch Houston access password
        if (!config.houston_password) {
            config.houston_password = uuidv4();
        }

        fs.writeFileSync(path.join(config.appDataPath, 'houston.txt'), config.houston_password);
        log.notify('================================================================');
        log.notify('Houston password stored in file                                 ');
        log.notify('================================================================');

        // Starting the kademlia
        const transport = container.resolve('transport');
        await transport.init(container.cradle);

        // Starting event listener on Blockchain
        this.listenBlockchainEvents(blockchain);
        dhService.listenToBlockchainEvents();

        try {
            await profileService.initProfile();
            await this._runPayoutMigration(blockchain, config);
            await profileService.upgradeProfile();
        } catch (e) {
            log.error('Failed to create profile');
            console.log(e);
            notifyBugsnag(e);
            process.exit(1);
        }
        await transport.start();

        // Check if ERC725 has valid node ID.
        const profile = await blockchain.getProfile(config.erc725Identity);

        if (!profile.nodeId.toLowerCase().startsWith(`0x${config.identity.toLowerCase()}`)) {
            await blockchain.setNodeId(
                config.erc725Identity,
                Utilities.normalizeHex(config.identity.toLowerCase()),
            );
        }

        // Initialise API
        const restApiController = container.resolve('restApiController');

        try {
            await restApiController.startRPC();
        } catch (err) {
            log.error('Failed to start RPC server');
            console.log(err);
            notifyBugsnag(err);
            process.exit(1);
        }
        if (config.remote_control_enabled) {
            log.info(`Remote control enabled and listening on port ${config.node_remote_control_port}`);
            await remoteControl.connect();
        }

        const commandExecutor = container.resolve('commandExecutor');
        await commandExecutor.init();
        await commandExecutor.replay();
        await commandExecutor.start();
        appState.started = true;
    }

    /**
     * Backs up network identity files if they are from the old network version
     * @param config
     * @returns {Promise<void>}
     * @private
     */
    async _runNetworkIdentityMigration(config) {
        const migrationsStartedMills = Date.now();

        const migrationDir = path.join(config.appDataPath, 'migrations');
        const m3NetworkIdentityMigrationFilename = '3_m3NetworkIdentityMigrationFile';
        const migrationFilePath = path.join(migrationDir, m3NetworkIdentityMigrationFilename);
        if (!fs.existsSync(migrationFilePath)) {
            const migration = new M3NetowrkIdentityMigration({ logger: log, config });
            try {
                await migration.run();
                log.notify(`One-time network identity migration completed. Lasted ${Date.now() - migrationsStartedMills} millisecond(s)`);

                await Utilities.writeContentsToFile(migrationDir, m3NetworkIdentityMigrationFilename, 'PROCESSED');
            } catch (e) {
                log.error(`Failed to run code migrations. Lasted ${Date.now() - migrationsStartedMills} millisecond(s). ${e.message}`);
                console.log(e);
                notifyBugsnag(e);
                process.exit(1);
            }
        }
    }

    async _runArangoMigration(config) {
        const migrationsStartedMills = Date.now();

        const m1PayoutAllMigrationFilename = '4_m4ArangoMigrationFile';
        const migrationDir = path.join(config.appDataPath, 'migrations');
        const migrationFilePath = path.join(migrationDir, m1PayoutAllMigrationFilename);
        if (!fs.existsSync(migrationFilePath)) {
            const migration = new M4ArangoMigration({ logger: log, config });

            try {
                log.info('Initializing Arango migration...');
                await migration.run();
                log.warn(`One-time payout migration completed. Lasted ${Date.now() - migrationsStartedMills} millisecond(s)`);

                await Utilities.writeContentsToFile(migrationDir, m1PayoutAllMigrationFilename, 'PROCESSED');
            } catch (e) {
                log.error(`Failed to run code migrations. Lasted ${Date.now() - migrationsStartedMills} millisecond(s). ${e.message}`);
                console.log(e);
                notifyBugsnag(e);
                process.exit(1);
            }
        }
    }

    /**
     * Run one time payout migration
     * @param blockchain
     * @param config
     * @returns {Promise<void>}
     * @private
     */
    async _runPayoutMigration(blockchain, config) {
        const migrationsStartedMills = Date.now();
        log.info('Initializing payOut migration...');

        const m1PayoutAllMigrationFilename = '1_m1PayoutAllMigrationFile';
        const migrationDir = path.join(config.appDataPath, 'migrations');
        const migrationFilePath = path.join(migrationDir, m1PayoutAllMigrationFilename);
        if (!fs.existsSync(migrationFilePath)) {
            const migration = new M1PayoutAllMigration({ logger: log, blockchain, config });

            try {
                await migration.run();
                log.warn(`One-time payout migration completed. Lasted ${Date.now() - migrationsStartedMills} millisecond(s)`);

                await Utilities.writeContentsToFile(migrationDir, m1PayoutAllMigrationFilename, 'PROCESSED');
            } catch (e) {
                log.error(`Failed to run code migrations. Lasted ${Date.now() - migrationsStartedMills} millisecond(s). ${e.message}`);
                console.log(e);
                notifyBugsnag(e);
                process.exit(1);
            }
        }
    }

    /**
     * Starts bootstrap node
     * @return {Promise<void>}
     */
    async startBootstrapNode({ appState }, web3) {
        const container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });

        container.loadModules(['modules/command/**/*.js', 'modules/controller/**/*.js', 'modules/service/**/*.js', 'modules/Blockchain/plugin/hyperledger/*.js', 'modules/migration/*.js'], {
            formatName: 'camelCase',
            resolverOptions: {
                lifetime: awilix.Lifetime.SINGLETON,
                register: awilix.asClass,
            },
        });

        container.register({
            emitter: awilix.asValue({}),
            web3: awilix.asValue(web3),
            blockchain: awilix.asClass(Blockchain).singleton(),
            blockchainPluginService: awilix.asClass(BlockchainPluginService).singleton(),
            approvalService: awilix.asClass(ApprovalService).singleton(),
            kademlia: awilix.asClass(Kademlia).singleton(),
            config: awilix.asValue(config),
            appState: awilix.asValue(appState),
            remoteControl: awilix.asClass(RemoteControl).singleton(),
            logger: awilix.asValue(log),
            kademliaUtilities: awilix.asClass(KademliaUtilities).singleton(),
            notifyError: awilix.asFunction(() => notifyBugsnag).transient(),
            transport: awilix.asValue(Transport()),
            apiUtilities: awilix.asClass(APIUtilities).singleton(),
            restApiController: awilix.asClass(RestApiController).singleton(),
            graphStorage: awilix.asValue(new GraphStorage(config.database, log, notifyBugsnag)),
            epcisOtJsonTranspiler: awilix.asClass(EpcisOtJsonTranspiler).singleton(),
            wotOtJsonTranspiler: awilix.asClass(WotOtJsonTranspiler).singleton(),
            schemaValidator: awilix.asClass(SchemaValidator).singleton(),
            importService: awilix.asClass(ImportService).singleton(),
        });

        const transport = container.resolve('transport');
        await transport.init(container.cradle);
        await transport.start();

        const blockchain = container.resolve('blockchain');
        await blockchain.initialize();

        const approvalService = container.resolve('approvalService');
        await approvalService.initialize();

        this.listenBlockchainEvents(blockchain);
        blockchain.subscribeToEventPermanentWithCallback([
            'NodeApproved',
            'NodeRemoved',
        ], (eventData) => {
            approvalService.handleApprovalEvent(eventData);
        });

        const restApiController = container.resolve('restApiController');
        try {
            await restApiController.startRPC();
        } catch (err) {
            log.error('Failed to start RPC server');
            console.log(err);
            notifyBugsnag(err);
            process.exit(1);
        }
    }

    /**
     * Listen to all Bidding events
     * @param blockchain
     */
    listenBlockchainEvents(blockchain) {
        log.info('Starting blockchain event listener');

        const delay = 20000;
        let working = false;
        let deadline = Date.now();
        setInterval(async () => {
            if (!working && Date.now() > deadline) {
                working = true;
                await blockchain.getAllPastEvents('HOLDING_CONTRACT');
                await blockchain.getAllPastEvents('PROFILE_CONTRACT');
                await blockchain.getAllPastEvents('APPROVAL_CONTRACT');
                await blockchain.getAllPastEvents('LITIGATION_CONTRACT');
                await blockchain.getAllPastEvents('REPLACEMENT_CONTRACT');
                await blockchain.getAllPastEvents('OLD_HOLDING_CONTRACT'); // TODO remove after successful migration
                deadline = Date.now() + delay;
                working = false;
            }
        }, 5000);
    }
}


log.info(' ██████╗ ████████╗███╗   ██╗ ██████╗ ██████╗ ███████╗');
log.info('██╔═══██╗╚══██╔══╝████╗  ██║██╔═══██╗██╔══██╗██╔════╝');
log.info('██║   ██║   ██║   ██╔██╗ ██║██║   ██║██║  ██║█████╗');
log.info('██║   ██║   ██║   ██║╚██╗██║██║   ██║██║  ██║██╔══╝');
log.info('╚██████╔╝   ██║   ██║ ╚████║╚██████╔╝██████╔╝███████╗');
log.info(' ╚═════╝    ╚═╝   ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚══════╝');

log.info('======================================================');
log.info(`             OriginTrail Node v${pjson.version}`);
log.info('======================================================');
log.info('');


function main() {
    const otNode = new OTNode();
    otNode.bootstrap().then(() => {
        log.info('OT Node started');
    });
}

// Make sure the Sequelize meta table is migrated before running main.
const migrationSequelizeMeta = new M2SequelizeMetaMigration({ logger: log });
migrationSequelizeMeta.run().then(main);
