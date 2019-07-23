require('dotenv').config();

if (!process.env.NODE_ENV) {
    // Environment not set. Use the production.
    process.env.NODE_ENV = 'production';
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
const Importer = require('./modules/importer');
const GS1Importer = require('./modules/GS1Importer');
const GS1Utilities = require('./modules/GS1Utilities');
const WOTImporter = require('./modules/WOTImporter');
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
const ImportController = require('./modules/controller/import-controller');
const APIUtilities = require('./modules/api-utilities');
const RestAPIService = require('./modules/service/rest-api-service');
const M2SequelizeMetaMigration = require('./modules/migration/m2-sequelize-meta-migration');

const pjson = require('./package.json');
const configjson = require('./config/config.json');

const Web3 = require('web3');

const log = require('./modules/logger');

global.__basedir = __dirname;

let context;
const defaultConfig = configjson[
    process.env.NODE_ENV &&
    ['development', 'staging', 'stable', 'mariner', 'production'].indexOf(process.env.NODE_ENV) >= 0 ?
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
                const responseFromArango = await Utilities.getArangoDbVersion(config);
                log.info(`Arango server version ${responseFromArango.version} is up and running`);
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
            importer: awilix.asClass(Importer).singleton(),
            blockchain: awilix.asClass(Blockchain).singleton(),
            blockchainPluginService: awilix.asClass(BlockchainPluginService).singleton(),
            gs1Importer: awilix.asClass(GS1Importer).singleton(),
            gs1Utilities: awilix.asClass(GS1Utilities).singleton(),
            wotImporter: awilix.asClass(WOTImporter).singleton(),
            graphStorage: awilix.asValue(new GraphStorage(config.database, log, notifyBugsnag)),
            remoteControl: awilix.asClass(RemoteControl).singleton(),
            logger: awilix.asValue(log),
            kademliaUtilities: awilix.asClass(KademliaUtilities).singleton(),
            notifyError: awilix.asFunction(() => notifyBugsnag).transient(),
            notifyEvent: awilix.asFunction(() => notifyEvent).transient(),
            transport: awilix.asValue(Transport()),
            apiUtilities: awilix.asClass(APIUtilities).singleton(),
            importController: awilix.asClass(ImportController).singleton(),
            minerService: awilix.asClass(MinerService).singleton(),
            replicationService: awilix.asClass(ReplicationService).singleton(),
            restAPIService: awilix.asClass(RestAPIService).singleton(),
            challengeService: awilix.asClass(ChallengeService).singleton(),
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
            await this._runMigration();
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
            throw Error('ERC725 profile not created for this node ID. ' +
                `My identity ${config.identity}, profile's node id: ${profile.nodeId}.`);
        }

        // Initialise API
        const restAPIService = container.resolve('restAPIService');
        try {
            await restAPIService.startRPC();
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
     * Run one time migration
     * Note: implement migration service
     * @deprecated
     * @private
     */
    async _runMigration() {
        const migrationsStartedMills = Date.now();
        log.info('Initializing code migrations...');

        // Note: add migrations here

        log.info(`Code migrations completed. Lasted ${Date.now() - migrationsStartedMills}`);
    }

    /**
     * Starts bootstrap node
     * @return {Promise<void>}
     */
    async startBootstrapNode({ appState }, web3) {
        const container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });

        container.loadModules(['modules/Blockchain/plugin/hyperledger/*.js', 'modules/migration/*.js'], {
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
            restAPIService: awilix.asClass(RestAPIService).singleton(),
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

        const restAPIService = container.resolve('restAPIService');
        try {
            await restAPIService.startRPC();
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
