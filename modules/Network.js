process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const log = require('./Utilities').getLogger();
const levelup = require('levelup');
const sqldown = require('sqldown');
const encoding = require('encoding-down');
const kadence = require('@kadenceproject/kadence');
const config = require('./Config');
const async = require('async');
const fs = require('fs');
const NetworkUtilities = require('./NetworkUtilities');
const utilities = require('./Utilities');
const PeerCache = require('./kademlia/PeerCache');

let networkUtilities = {};

/**
 * DHT module (Kademlia)
 */
class Network {
    /**
     * Setup options and construct a node
     */
    constructor(ctx) {
        this.emitter = ctx.emitter;

        if (parseInt(config.test_network, 10)) {
            kadence.constants.IDENTITY_DIFFICULTY = 2;
            kadence.constants.SOLUTION_DIFFICULTY = 2;
        }
        networkUtilities = new NetworkUtilities();
        this.index = parseInt(config.child_derivation_index, 10);

        // Initialize private extended key
        utilities.createPrivateExtendedKey(kadence);
    }

    /**
     * Starts the node
     * @return {Promise<void>}
     */
    async start() {
        // Check config
        networkUtilities.verifyConfiguration(config);

        log.info('Checking SSL certificate');
        await networkUtilities.setSelfSignedCertificate(config);

        log.info('Getting the identity');
        this.xprivkey = fs.readFileSync(`${__dirname}/../keys/${config.private_extended_key_path}`).toString();
        this.identity = new kadence.eclipse.EclipseIdentity(this.xprivkey, this.index);

        log.info('Checking the identity');
        networkUtilities.checkIdentity(this.identity, this.xprivkey); // Check if identity is valid

        const { childkey, parentkey } = networkUtilities.getIdentityKeys(this.xprivkey);
        this.identity = kadence.utils.toPublicKeyHash(childkey.publicKey).toString('hex');

        log.notify(`My identity: ${this.identity}`);
        config.identity = this.identity;

        log.info('Initializing network');

        // Initialize public contact data
        const contact = {
            hostname: config.node_rpc_ip,
            protocol: 'https:',
            port: parseInt(config.node_port, 10),
            xpub: parentkey.publicExtendedKey,
            index: parseInt(config.child_derivation_index, 10),
            agent: kadence.version.protocol,
            wallet: config.node_wallet,
        };

        const key = fs.readFileSync(`${__dirname}/../keys/${config.ssl_keypath}`);
        const cert = fs.readFileSync(`${__dirname}/../keys/${config.ssl_certificate_path}`);
        const ca = config.ssl_authority_paths.map(fs.readFileSync);

        // Initialize transport adapter
        const transport = new kadence.HTTPSTransport({ key, cert, ca });

        // Initialize protocol implementation
        this.node = new kadence.KademliaNode({
            log,
            transport,
            identity: Buffer.from(this.identity, 'hex'),
            contact,
            storage: levelup(encoding(sqldown(`${__dirname}/Database/system.db`)), {
                table: 'node_data',
            }, (err) => {
                if (err) {
                    log.error('Failed to create SQLite3 Kademlia adapter');
                    throw err;
                }
            }),
        });
        log.info('Starting OT Node...');

        // Enable Quasar plugin used for publish/subscribe mechanism
        this.node.quasar = this.node.plugin(kadence.quasar());
        this.node.peercache = this.node.plugin(PeerCache(`${__dirname}/../data/${config.embedded_peercache_path}`));

        // We use Hashcash for relaying messages to prevent abuse and make large scale
        // DoS and spam attacks cost prohibitive
        // this.node.hashcash = this.node.plugin(kadence.hashcash({
        //     methods: ['PUBLISH', 'SUBSCRIBE', 'payload-sending'],
        //     difficulty: 10,
        // }));
        log.info('Hashcash initialised');

        if (parseInt(config.onion_enabled, 10)) {
            this.enableOnion();
        }

        if (parseInt(config.traverse_nat_enabled, 10)) {
            this.enableNatTraversal();
        }
        this._registerRoutes();

        // Use verbose logging if enabled
        if (parseInt(config.verbose_logging, 10)) {
            this.node.rpc.deserializer.append(new kadence.logger.IncomingMessage(log));
            this.node.rpc.serializer.prepend(new kadence.logger.OutgoingMessage(log));
        }
        // Cast network nodes to an array
        if (typeof config.network_bootstrap_nodes === 'string') {
            config.network_bootstrap_nodes = config.network_bootstrap_nodes.trim().split();
        }

        this.node.listen(parseInt(config.node_port, 10), () => {
            log.notify(`OT Node listening at https://${this.node.contact.hostname}:${this.node.contact.port}`);
            networkUtilities.registerControlInterface(config, this.node);

            if (parseInt(config.solve_hashes, 10)) {
                networkUtilities.spawnHashSolverProcesses(this.node);
            }

            async.retry({
                times: Infinity,
                interval: 60000,
            }, done => this._joinNetwork(done), (err, entry) => {
                if (err) {
                    log.error(err.message);
                    process.exit(1);
                }

                log.info(`Connected to network via ${entry[0]} (https://${entry[1].hostname}:${entry[1].port})`);
                log.info(`Discovered ${this.node.router.size} peers from seed`);
            });
        });
    }

    enableNatTraversal() {
        log.info('Trying NAT traversal');
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

    enableOnion() {
        log.info('Use Tor for an anonymous overlay');
        kadence.constants.T_RESPONSETIMEOUT = 20000;
        this.node.onion = this.node.plugin(kadence.onion({
            dataDirectory: `${__dirname}/../data/hidden_service`,
            virtualPort: config.onion_virtual_port,
            localMapping: `127.0.0.1:${config.node_port}`,
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

    /**
     * Try to join network
     * Note: this method tries to find possible bootstrap nodes from cache as well
     */
    _joinNetwork(callback) {
        const bootstrapNodes = config.network_bootstrap_nodes;

        const peercachePlugin = this.node.peercache;
        setTimeout(() => {
            peercachePlugin.getBootstrapCandidates().then((peers) => {
                log.info(`Found ${peers.length} possible bootstrap candidates from cache.`);
                const nodes = peers.concat(bootstrapNodes);

                log.info(`Joining network from ${nodes.length} seeds`);
                async.detectSeries(nodes, (url, done) => {
                    const contact = kadence.utils.parseContactURL(url);
                    this.node.join(contact, (err) => {
                        done(null, (!err) && this.node.router.size >= 1);
                    });
                }, (err, result) => {
                    if (!result) {
                        log.error('Failed to join network, will retry in 1 minute. Bootstrap node is probably not online.');
                        callback(new Error('Failed to join network'));
                    } else {
                        log.important('Joined the network');
                        const contact = kadence.utils.parseContactURL(result);
                        callback(null, contact);
                    }
                });
            });
        }, 500); // this delay is needed because of the peercache
    }

    /**
     * Register Kademlia routes and error handlers
     */
    _registerRoutes() {
        this.node.quasar.quasarSubscribe('bidding-broadcast-channel', (message, err) => {
            log.info('New bidding offer received');
            this.emitter.emit('bidding-broadcast', message);
        });

        // add payload-request route
        this.node.use('payload-request', (request, response, next) => {
            log.info('payload-request received');
            this.emitter.emit('payload-request', request, response);
            response.send({
                status: 'OK',
            });
        });

        // add payload-request error handler
        this.node.use('payload-request', (err, request, response, next) => {
            response.send({
                error: 'payload-request error',
            });
        });

        // add replication-request route
        this.node.use('replication-request', (request, response, next) => {
            log.info('replication-request received');
            this.emitter.emit('replication-request', request, response);
        });

        // add replication-finished route
        this.node.use('replication-finished', (request, response, next) => {
            log.info('replication-finished received');
            this.emitter.emit('replication-finished', request);
            response.send({
                status: 'OK',
            });
        });

        // add replication-finished error handler
        this.node.use('replication-finished', (err, request, response, next) => {
            response.send({
                error: 'replication-finished error',
            });
        });

        // add challenge-request route
        this.node.use('challenge-request', (request, response, next) => {
            log.info('challenge-request received');
            this.emitter.emit('kad-challenge-request', request, response);
        });

        // add challenge-request error handler
        this.node.use('challenge-request', (err, request, response, next) => {
            response.send({
                error: 'challenge-request error',
            });
        });

        // TODO remove temp add bid route
        this.node.use('add-bid', (request, response, next) => {
            log.info('add-bid');
            const { bid } = request.params.message;
            [bid.dhId] = request.contact;
            response.send({
                status: 'OK',
            });
        });

        // TODO remove temp add bid route
        this.node.use('add-bid', (err, request, response, next) => {
            log.error('add-bid failed');
            response.send({
                error: 'add-bid error',
            });
        });

        // add kad-bidding-won route
        this.node.use('kad-bidding-won', (request, response, next) => {
            log.info('kad-bidding-won received');
            this.emitter.emit('kad-bidding-won', request, response);
        });

        // add kad-bidding-won error handler
        this.node.use('kad-bidding-won', (err, request, response, next) => {
            response.send({
                error: 'kad-bidding-won error',
            });
        });

        // creates Kadence plugin for RPC calls
        this.node.plugin((node) => {
            /**
             * Helper method for getting nearest contact (used for testing purposes only)
             * @returns {*}
             */
            node.getNearestNeighbour = () =>
                [...node.router.getClosestContactsToKey(this.identity).entries()].shift();

            /**
             * Gets contact by ID
             * @param contactId Contact ID
             * @returns {{"{": Object}|Array}
             */
            node.getContact = contactId => node.router.getContactByNodeId(contactId);

            /**
             * Sends payload request to DH
             * @param message   Payload to be sent
             * @param contactId  KADemlia contact ID to be sent to
             * @param callback  Response/Error callback
             */
            node.payloadRequest = (message, contactId, callback) => {
                const contact = node.getContact(contactId);
                node.send('payload-request', { message }, [contactId, contact], callback);
            };

            /**
             * Sends replication request to the DC
             * @param message
             * @param contactId KADemlia contact ID to be sent to
             * @param callback
             */
            node.replicationRequest = (message, contactId, callback) => {
                // contactId = utilities.numberToHex(contactId).substring(2);
                const contact = node.getContact(contactId);
                node.send('replication-request', { message }, [contactId, contact], callback);
            };

            /**
             * Sends replication finished direct message
             * @param message   Payload to be sent
             * @param contactId KADemlia contact ID to be sent to
             * @param callback  Response/Error callback
             */
            node.replicationFinished = (message, contactId, callback) => {
                const contact = node.getContact(contactId);
                node.send('replication-finished', { message }, [contactId, contact], callback);
            };

            /**
             * Sends challenge request direct message
             * @param message   Payload to be sent
             * @param contactId  KADemlia contact ID to be sent to
             * @param callback  Response/Error callback
             */
            node.challengeRequest = (message, contactId, callback) => {
                const contact = node.getContact(contactId);
                node.send('challenge-request', { message }, [contactId, contact], callback);
            };

            /**
             * Sends add bid to DC
             * TODO remove after SC intro
             * @param message   Payload to be sent
             * @param contactId  KADemlia contact ID to be sent to
             * @param callback  Response/Error callback
             */
            node.addBid = (message, contactId, callback) => {
                const contact = node.getContact(contactId);
                node.send('add-bid', { message }, [contactId, contact], callback);
            };

            node.biddingWon = (message, contactId, callback) => {
                const contact = node.getContact(contactId);
                node.send('kad-bidding-won', { message }, [contactId, contact], callback);
            };
        });
        // Define a global custom error handler rule
        this.node.use((err, request, response, next) => {
            response.send({ error: err.message });
        });
    }

    kademlia() {
        return this.node;
    }
}

module.exports = Network;
