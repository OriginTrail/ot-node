// start(...)
// connectToSeed(...)
// sendBroadcast(...)
// sendDirectMessage(...)
// onDirectMessage(...)
// broadcastMessage(...)
// onBroadcastMessage(...)

const { EventEmitter } = require('events');
const crypto = require('crypto');
const assert = require('assert');
const log = require('./utilities').getLogger();
const levelup = require('levelup');
const encoding = require('encoding-down');
const leveldown = require('leveldown');
const kadence = require('@kadenceproject/kadence');
const boscar = require('boscar');
const deasync = require('deasync-promise');
const async = require('async');
const hdkey = require('hdkey');
const { fork } = require('child_process');
const fs = require('fs');
const os = require('os');
const ms = require('ms');
const path = require('path');


const utilities = require('./utilities');

// TODO: change it for sqlite
const storage = levelup(encoding(leveldown('kad-storage/storage.db')));
const transport = new kadence.HTTPTransport();

/**
 * DHT module (Kademlia)
 */

class Network {
    /**
   * Setup options and construct a node
   */
    constructor(config) {
        this.config = config;

        this.index = parseInt(config.child_derivation_index, 10);

        // Initialize private extended key
        utilities.createPrivateExtendedKey(config, kadence);

        this.solvers = [];
    }


    async setSelfSignedCertificate() {
        if (!fs.existsSync(`../keys/${this.config.ssl_key_path}`)) {
            await utilities.generateSelfSignedCertificate(this.config);
        }
    }

    async solveIdentity() {
        const events = new EventEmitter();
        const opts = __dirname;
        const start = Date.now();
        let time;
        let attempts = 0;
        const status = setInterval(() => {
            log.info('Still solving identity, ' +
                `currently ${attempts} of ${kadence.constants.MAX_NODE_INDEX} ` +
                `possible indices tested in the last ${ms(Date.now() - start)}`);
        }, 60000);

        log.info(`Solving identity derivation index with ${this.config.cpus} ` +
            'solver processes, this can take a while...');

        events.on('attempt', () => attempts += 1);

        try {
            this.index = await this.spawnDerivationProcesses(this.xprivkey, events);
            time = Date.now() - start;
        } catch (err) {
            log.error(err.message.toLowerCase());
            log.info(`Delete/move ${this.config.private_extended_key_path} and restart`);
            process.exit(1);
        }

        events.removeAllListeners();
        clearInterval(status);
        log.info(`Solved identity derivation index ${this.index} in ${ms(time)}`);
        // TODO: Save to database
        this.config.child_derivation_index = this.index;


        // opts.ChildDerivationIndex = this.index;
        // fs.writeFileSync(program.config, ini.stringify(opts));
        // config = rc('kadence', opts, argv);
    }

    async spawnDerivationProcesses(xprivkey, events) {
        const cpus = parseInt(this.config.cpus, 10);

        if (cpus === 0) {
            return log.info('There are no derivation processes running');
        }

        if (os.cpus().length < cpus) {
            return log.error('Refusing to start more solvers than cpu cores');
        }

        for (let c = 0; c < cpus; c += 1) {
            const index = Math.floor(kadence.constants.MAX_NODE_INDEX / cpus) * c;
            const solver = this.forkDerivationSolver(c, xprivkey, index, events);

            this.solvers.push(this.solver);

            solver.once('exit', (code) => {
                if (code === 0) {
                    log.info(`Derivation solver ${c} exited normally`);
                } else {
                    log.error(`Derivation solver ${c} exited with code ${code}`);
                }
            });
        }

        return new Promise((resolve, reject) => {
            events.once('index', (i) => {
                events.removeAllListeners();
                // this.solvers.forEach(s => s.kill('SIGTERM'));
                resolve(i);
            });
        });
    }

    forkDerivationSolver(c, xprv, index, events) {
        log.info(`Forking derivation process ${c}`);

        const solver = fork(path.join(__dirname, 'workers', 'identity.js'), [], {
            stdio: [0, 1, 2, 'ipc'],
            env: process.env,
        });


        solver.on('message', (msg) => {
            if (msg.error) {
                return log.error(`Derivation ${c} error, ${msg.error}`);
            }

            if (msg.attempts) {
                return events.emit('attempt');
            }

            events.emit('index', msg.index);
        });

        solver.on('error', (err) => {
            log.error(`Derivation ${c} error, ${err.message}`);
        });

        solver.send([xprv, index]);

        return solver;
    }

    registerControlInterface(config) {
        assert(
            !(parseInt(config.control_port_enabled, 10) &&
            parseInt(config.control_sock_enabled, 10)),
            'ControlSock and ControlPort cannot both be enabled',
        );

        const controller = new boscar.Server(new kadence.Control(this.node));

        if (parseInt(config.control_port_enabled, 10)) {
            log.info(`binding controller to port ${config.control_port}`);
            log.listen(parseInt(config.control_port, 10), '0.0.0.0');
        }

        if (parseInt(config.ControlSockEnabled, 10)) {
            log.info(`binding controller to path ${config.control_sock}`);
            controller.listen(config.control_sock);
        }
    }


    spawnSolverProcesses() {
        const cpus = parseInt(this.config.cpus, 10);

        if (cpus === 0) {
            return log.info('There are no solver processes running');
        }

        if (os.cpus().length < cpus) {
            return log.error('Refusing to start more solvers than cpu cores');
        }

        for (let c = 0; c < cpus; c += 1) {
            this.forkIdentitySolver(c);
        }
    }

    forkIdentitySolver(c) {
        log.info(`Forking solver process ${c}`);

        const solver = fork(path.join(__dirname, 'workers', 'solver.js'), [], {
            stdio: [0, 1, 2, 'ipc'],
            env: process.env,
        });

        solver.on('message', (msg) => {
            if (msg.error) {
                return log.error(`Solver ${c} error, ${msg.error}`);
            }

            log.info(`Solver ${c} found solution ` +
                `in ${msg.result.attempts} attempts (${ms(msg.result.time)})`);

            const solution = new kadence.permission.PermissionSolution(Buffer.from(msg.result.solution, 'hex'));
            this.node.wallet.put(solution);
        });

        solver.on('error', (err) => {
            log.error(`solver ${c} error, ${err.message}`);
        });

        solver.send({ privateKey: this.node.spartacus.privateKey.toString('hex') });
        this.solvers.push(solver);
    }

    getIdentityKeys() {
        // Start initializing identity keys
        const parentkey = hdkey.fromExtendedKey(this.xprivkey)
            .derive(kadence.constants.HD_KEY_DERIVATION_PATH);
        const childkey = parentkey.deriveChild(parseInt(39, 10));
        return {
            childkey,
            parentkey,
        };
    }

    checkSettings() {
        const { config } = this;
        if (parseInt(config.test_network, 10)) {
            log.info('Node is running in test mode, difficulties are reduced');
            process.env.kadence_TestNetworkEnabled = config.test_network;
            kadence.constants.SOLUTION_DIFFICULTY = 2;
            kadence.constants.IDENTITY_DIFFICULTY = 2;
        }

        if (parseInt(config.traverse_nat_enabled, 10) && parseInt(config.onion_enabled, 10)) {
            log.error('refusing to start with both TraverseNatEnabled and ' +
                'OnionEnabled - this is a privacy risk');
            process.exit(1);
        }
    }

    async start() {
        this.checkSettings();
        const { config } = this;

        config.SSLAuthorityPaths = [];

        log.info('Checking SSL certificate');
        this.setSelfSignedCertificate();

        log.info('Getting the identity');
        this.xprivkey = fs.readFileSync(`${__dirname}/../keys/${this.config.private_extended_key_path}`).toString();
        this.identity = new kadence.eclipse.EclipseIdentity(this.xprivkey, this.index);

        // Check if identity is valid ?
        if (!this.identity.validate(this.xprivkey, this.index)) {
            log.warn(`Identity is not yet generated. Identity derivation not yet solved - ${this.index} is invalid`);
            deasync(this.solveIdentity());
        }

        const { childkey, parentkey } = this.getIdentityKeys();

        this.identity = kadence.utils.toPublicKeyHash(childkey.publicKey)
            .toString('hex');


        log.info('Initializing network');

        // Initialize public contact data
        const contact = {
            hostname: config.node_rpc_ip,
            protocol: 'https:',
            port: parseInt(config.node_rpc_port, 10),
            xpub: parentkey.publicExtendedKey,
            index: parseInt(config.child_derivation_index, 10),
            agent: kadence.version.protocol,
        };

        const key = fs.readFileSync(`${__dirname}/../keys/${config.ssl_key_path}`);
        const cert = fs.readFileSync(`${__dirname}/../keys/${config.ssl_certificate_path}`);
        // const ca = config.SSLAuthorityPaths.map(fs.readFileSync);
        const ca = config.SSLAuthorityPaths;

        // Initialize transport adapter
        const transport = new kadence.HTTPSTransport({ key, cert, ca });

        // Initialize protocol implementation
        this.node = new kadence.KademliaNode({
            log,
            transport,
            contact,
            storage: levelup(encoding(leveldown(`${__dirname}/../kad-storage/kadence.dht`))),
        });

        log.info('Starting OT Node...');

        // We use Hashcash for relaying messages to prevent abuse and make large scale
        // DoS and spam attacks cost prohibitive
        this.node.hashcash = this.node.plugin(kadence.hashcash({
            methods: ['PUBLISH', 'SUBSCRIBE'],
            difficulty: 8,
        }));

        // Quasar - A Probabilistic Publish-Subscribe System
        this.node.quasar = this.node.plugin(kadence.quasar());

        // Mitigate Spartacus attacks - Sybil
        this.node.spartacus = this.node.plugin(kadence.spartacus(
            this.xprivkey,
            parseInt(config.child_derivation_index, 10),
            kadence.constants.HD_KEY_DERIVATION_PATH,
        ));

        // Mitigate Eclipse attacks
        this.node.eclipse = this.node.plugin(kadence.eclipse());

        this.node.permission = this.node.plugin(kadence.permission({
            privateKey: this.node.spartacus.privateKey,
            walletPath: `${__dirname}/../wallet.dat`,
        }));

        // Store peers in cache
        this.node.rolodex = this.node.plugin(kadence.rolodex(`${__dirname}/../keys/${config.embedded_peercache_path}`));

        log.info('Validating solutions in wallet, this can take some time');
        await this.node.wallet.validate();

        // Hibernate when bandwidth thresholds are reached
        // this.node.hibernate = this.node.plugin(kadence.hibernate({
        //     limit: config.BandwidthAccountingMax,
        //     interval: config.BandwidthAccountingReset,
        //     reject: ['FIND_VALUE', 'STORE'],
        // }));

        // Use Tor for an anonymous overlay
        if (parseInt(config.onion_enabled, 10)) {
            kadence.constants.T_RESPONSETIMEOUT = 20000;
            this.node.onion = this.node.plugin(kadence.onion({
                dataDirectory: `${__dirname}/../hidden_service`,
                virtualPort: config.onion_virtual_port,
                localMapping: `127.0.0.1:${config.node_rpc_port}`,
                torrcEntries: {
                    CircuitBuildTimeout: 10,
                    KeepalivePeriod: 60,
                    NewCircuitPeriod: 60,
                    NumEntryGuards: 8,
                    Log: 'notice stdout',
                },
                passthroughLoggingEnabled: 1,
            }));
        }

        if (parseInt(config.travers_nat_enabled, 10)) {
            this.node.traverse = this.node.plugin(kadence.traverse([
                new kadence.traverse.UPNPStrategy({
                    mappingTtl: parseInt(config.traverse_port_forward_ttl, 10),
                    publicPort: parseInt(this.node.contact.port, 10),
                }),
                new kadence.traverse.NATPMPStrategy({
                    mappingTtl: parseInt(config.traverse_port_forward_ttl, 10),
                    publicPort: parseInt(this.node.contact.port, 10),
                }),
            ]));
        }

        // Handle any fatal errors
        this.node.on('error', (err) => {
            log.error(err.message.toLowerCase());
        });

        // Use verbose logging if enabled
        if (parseInt(config.verbose_logging, 10)) {
            this.node.rpc.deserializer.append(new kadence.logger.IncomingMessage(log));
            this.node.rpc.serializer.prepend(new kadence.logger.OutgoingMessage(log));
        }
        this.config.NetworkBootstrapNodes = []; // TODO: staviti u config


        this.node.listen(parseInt(config.node_rpc_port, 10), () => {
            log.info(`Node listening on local port ${config.node_rpc_port} ` +
                `and exposed at https://${this.node.contact.hostname}:${this.node.contact.port}`);
            this.registerControlInterface(config);
            this.spawnSolverProcesses();
            async.retry({
                times: Infinity,
                interval: 60000,
            }, done => this.joinNetwork(done), (err, entry) => {
                if (err) {
                    log.error(err.message);
                    process.exit(1);
                }

                log.info(`Connected to network via ${entry[0]} ` +
                    `(http://${entry[1].hostname}:${entry[1].port})`);
                log.info(`Discovered ${this.node.router.size} peers from seed`);
            });
        });

        // this.this.node.plugin(kadence.quasar());
        //
        //
        // this.node.listen(this.config.node_rpc_port);
        // log.info(`Listening on port ${this.config.node_rpc_port}`);


        // this.node.join(['ea48d3f07a5241291ed0b4cab6483fa8b8fcc123', {
        //     hostname: 'localhost',
        //     port: this.config.node_rpc_port,
        // }], () => {
        // Add 'join' callback which indicates peers were discovered and
        // our node is now connected to the overlay network
        //     log.info(`Connected to ${this.node.router.length} peers!`);

        // Base protocol exposes:
        // * node.iterativeFindNode(key, callback)
        // * node.iterativeFindValue(key, callback)
        // * node.iterativeStore(key, value, callback)
        //
        // Quasar plugin exposes:
        // * node.quasarPublish(topic, content)
        // * node.quasarSubscribe(topic, handler)
        // * node.quasarUpdate(callback)
        //
        // Example plugin exposes:
        // * node.sendNeighborEcho(text, callback)
        // });
    }

    async joinNetwork(callback) {
        var { config } = this;

        const peers
            = this.config.NetworkBootstrapNodes.concat(await this.node.rolodex.getBootstrapCandidates());

        if (peers.length === 0) {
            log.info('No bootstrap seeds provided and no known profiles');
            log.info('Running in seed mode (waiting for connections)');

            return this.node.router.events.once('add', (identity) => {
                console.log(identity);
                this.config.NetworkBootstrapNodes = [
                    kadence.utils.getContactURL([
                        identity,
                        this.node.router.getContactByNodeId(identity),
                    ]),
                ];
                this.joinNetwork(callback);
            });
        }

        log.info(`Joining network from ${peers.length} seeds`);
        async.detectSeries(peers, (url, done) => {
            const contact = kadence.utils.parseContactURL(url);
            this.node.join(contact, (err) => {
                done(null, (!err) && this.node.router.size > 1);
            });
        }, (err, result) => {
            if (!result) {
                log.error('Failed to join network, will retry in 1 minute');
                callback(new Error('Failed to join network'));
            } else {
                callback(null, entry);
            }
        });
    }
}


module.exports = Network;

