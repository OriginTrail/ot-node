process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const levelup = require('levelup');
const sqldown = require('sqldown');
const encoding = require('encoding-down');
const kadence = require('@kadenceproject/kadence');
const config = require('./Config');
const async = require('async');
const fs = require('fs');
const utilities = require('./Utilities');
const PeerCache = require('./kademlia/PeerCache');
const _ = require('lodash');

/**
 * DHT module (Kademlia)
 */
class Network {
    /**
     * Setup options and construct a node
     */
    constructor(ctx) {
        this.log = ctx.logger;
        this.emitter = ctx.emitter;
        this.networkUtilities = ctx.networkUtilities;

        if (parseInt(config.test_network, 10)) {
            this.log.warn('Node is running in test mode, difficulties are reduced');
            process.env.kadence_TestNetworkEnabled = config.test_network;
            kadence.constants.SOLUTION_DIFFICULTY = 2;
            kadence.constants.IDENTITY_DIFFICULTY = 2;
        }
        this.index = parseInt(config.child_derivation_index, 10);

        // Initialize private extended key
        utilities.createPrivateExtendedKey(kadence);
    }

    /**
     * Initializes keys
     * @return {Promise<void>}
     */
    async initialize() {
        // Check config
        this.networkUtilities.verifyConfiguration(config);

        this.log.info('Checking SSL certificate');
        await this.networkUtilities.setSelfSignedCertificate(config);

        this.log.info('Getting the identity');
        this.xprivkey = fs.readFileSync(`${__dirname}/../keys/${config.private_extended_key_path}`).toString();
        this.identity = new kadence.eclipse.EclipseIdentity(this.xprivkey, this.index);

        this.log.info('Checking the identity');
        this.networkUtilities.checkIdentity(
            this.identity,
            this.xprivkey,
        ); // Check if identity is valid

        const { childkey } = this.networkUtilities.getIdentityKeys(
            this.xprivkey,
            kadence.constants.HD_KEY_DERIVATION_PATH,
            parseInt(config.child_derivation_index, 10),
        );
        this.identity = kadence.utils.toPublicKeyHash(childkey.publicKey).toString('hex');

        this.log.notify(`My identity: ${this.identity}`);
        config.identity = this.identity;
    }

    /**
     * Starts the node
     * @return {Promise<void>}
     */
    async start() {
        this.log.info('Initializing network');

        const { parentkey } = this.networkUtilities.getIdentityKeys(
            this.xprivkey,
            kadence.constants.HD_KEY_DERIVATION_PATH,
            parseInt(config.child_derivation_index, 10),
        );

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
            logger: this.log,
            transport,
            identity: Buffer.from(this.identity, 'hex'),
            contact,
            storage: levelup(encoding(sqldown(`${__dirname}/Database/system.db`)), {
                table: 'node_data',
            }, (err) => {
                if (err) {
                    this.log.error('Failed to create SQLite3 Kademlia adapter');
                    throw err;
                }
            }),
        });
        this.log.info('Starting OT Node...');
        this.node.quasar = this.node.plugin(kadence.quasar());
        this.log.info('Quasar initialised');
        // this.node.eclipse = this.node.plugin(kadence.eclipse());
        this.node.peercache = this.node.plugin(PeerCache(`${__dirname}/../data/${config.embedded_peercache_path}`));
        this.log.info('Peercache initialised');
        // this.node.spartacus = this.node.plugin(kadence.spartacus(
        //     this.xprivkey,
        //     parseInt(config.child_derivation_index, 10),
        // ));
        // this.log.info('Spartacus initialised');
        // this.node.hashcash = this.node.plugin(kadence.hashcash({
        //     methods: ['PUBLISH', 'SUBSCRIBE'],
        //     difficulty: 2,
        // }));
        // this.log.info('Hashcash initialised');

        if (parseInt(config.onion_enabled, 10)) {
            this.enableOnion();
        }

        if (parseInt(config.traverse_nat_enabled, 10)) {
            this.enableNatTraversal();
        }

        // Use verbose logging if enabled
        if (parseInt(config.verbose_logging, 10)) {
            this.node.rpc.deserializer.append(new kadence.logger.IncomingMessage(this.log));
            this.node.rpc.serializer.prepend(new kadence.logger.OutgoingMessage(this.log));
        }
        // Cast network nodes to an array
        if (typeof config.network_bootstrap_nodes === 'string') {
            config.network_bootstrap_nodes = config.network_bootstrap_nodes.trim().split();
        }

        if (!utilities.isBootstrapNode()) {
            this._registerRoutes();
        }

        this.node.listen(parseInt(config.node_port, 10), () => {
            this.log.notify(`OT Node listening at https://${this.node.contact.hostname}:${this.node.contact.port}`);
            this.networkUtilities.registerControlInterface(config, this.node);

            const retryPeriod = 5000;
            async.retry({
                times: Infinity,
                interval: retryPeriod,
            }, done => this._joinNetwork(done, retryPeriod), (err) => {
                if (err) {
                    this.log.error(err.message);
                    process.exit(1);
                }
            });
        });
    }

    enableNatTraversal() {
        this.log.info('Trying NAT traversal');
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
        this.log.info('Use Tor for an anonymous overlay');
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
        this.log.info('Onion initialised');
    }

    /**
     * Try to join network
     * Note: this method tries to find possible bootstrap nodes from cache as well
     */
    _joinNetwork(callback, retryPeriod) {
        const bootstrapNodes = config.network_bootstrap_nodes;

        const peercachePlugin = this.node.peercache;
        peercachePlugin.getBootstrapCandidates().then((peers) => {
            const isBootstrap = bootstrapNodes.length === 0;
            const nodes = _.uniq(bootstrapNodes.concat(peers));

            if (isBootstrap) {
                this.log.info(`Found ${bootstrapNodes.length} provided bootstrap node(s). Running as a Bootstrap node`);
                this.log.info(`Found additional ${peers.length} peers in peer cache`);
                this.log.info(`Trying to contact ${nodes.length} peers from peer cache`);
            } else {
                this.log.info(`Found ${bootstrapNodes.length} provided bootstrap node(s)`);
                this.log.info(`Found additional ${peers.length} peers in peer cache`);
                this.log.info(`Trying to join the network from ${nodes.length} unique seeds`);
            }

            if (nodes.length === 0) {
                this.log.info('No bootstrap seeds provided and no known profiles');
                this.log.info('Running in seed mode (waiting for connections)');

                this.node.router.events.once('add', (identity) => {
                    config.NetworkBootstrapNodes = [
                        kadence.utils.getContactURL([
                            identity,
                            this.node.router.getContactByNodeId(identity),
                        ]),
                    ];
                    this._joinNetwork(callback, retryPeriod);
                });
                callback();
                return;
            }

            async.detectSeries(nodes, (url, done) => {
                const contact = kadence.utils.parseContactURL(url);
                this.node.join(contact, (err) => {
                    done(null, (!err) && this.node.router.size >= 1);
                });
            }, (err, result) => {
                if (result) {
                    this.log.important('Joined the network');
                    const contact = kadence.utils.parseContactURL(result);

                    this.log.info(`Connected to network via ${contact[0]} (https://${contact[1].hostname}:${contact[1].port})`);
                    this.log.info(`Discovered ${this.node.router.size} peers from seed`);
                    callback();
                } else if (!isBootstrap) {
                    this.log.error(`Failed to join network, will retry in ${retryPeriod / 1000} seconds. Bootstrap nodes are probably not online.`);
                    callback(new Error('Failed to join network'));
                } else {
                    this.log.info('Bootstrap node couldn\'t contact peers from peer cache. Waiting for some peers.');
                    callback();
                }
            });
        });
    }

    /**
     * Register Kademlia routes and error handlers
     */
    _registerRoutes() {
        this.node.quasar.quasarSubscribe('data-location-request', (message, err) => {
            this.log.info('New location request received');
            this.emitter.emit('kad-data-location-request', message);
        });


        // add payload-request route
        this.node.use('payload-request', (request, response, next) => {
            this.log.info('payload-request received');
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
            this.log.info('replication-request received');
            this.emitter.emit('replication-request', request, response);
        });

        // add replication-finished route
        this.node.use('replication-finished', (request, response, next) => {
            this.log.info('replication-finished received');
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

        this.node.use('kad-data-location-response', (request, response, next) => {
            this.log.info('kad-data-location-response received');
            this.emitter.emit('kad-data-location-response', request, response);
        });

        this.node.use('kad-data-read-request', (request, response, next) => {
            this.log.info('kad-data-read-request received');
            this.emitter.emit('kad-data-read-request', request, response);
        });

        this.node.use('kad-data-read-response', (request, response, next) => {
            this.log.info('kad-data-read-response received');
            this.emitter.emit('kad-data-read-response', request, response);
        });

        this.node.use('kad-send-encrypted-key', (request, response, next) => {
            this.log.info('kad-send-encrypted-key received');
            this.emitter.emit('kad-send-encrypted-key', request, response);
        });

        this.node.use('kad-verify-import-request', (request, response, next) => {
            this.log.info('kad-verify-import-request received');
            this.emitter.emit('kad-verify-import-request', request, response);
        });

        this.node.use('kad-verify-import-response', (request, response, next) => {
            this.log.info('kad-verify-import-response received');
            this.emitter.emit('kad-verify-import-response', request, response);
        });

        // add challenge-request route
        this.node.use('challenge-request', (request, response, next) => {
            this.log.info('challenge-request received');
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
            this.log.info('add-bid');
            const { bid } = request.params.message;
            [bid.dhId] = request.contact;
            response.send({
                status: 'OK',
            });
        });

        // TODO remove temp add bid route
        this.node.use('add-bid', (err, request, response, next) => {
            this.log.error('add-bid failed');
            response.send({
                error: 'add-bid error',
            });
        });

        // add kad-bidding-won route
        this.node.use('kad-bidding-won', (request, response, next) => {
            this.log.info('kad-bidding-won received');
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

            node.sendDataLocationResponse = (message, contactId, callback) => {
                const contact = node.getContact(contactId);
                node.send('kad-data-location-response', { message }, [contactId, contact], callback);
            };

            node.dataReadRequest = (message, contactId, callback) => {
                const contact = node.getContact(contactId);
                node.send('kad-data-read-request', { message }, [contactId, contact], callback);
            };

            node.sendDataReadResponse = (message, contactId, callback) => {
                const contact = node.getContact(contactId);
                node.send('kad-data-read-response', { message }, [contactId, contact], callback);
            };

            node.sendEncryptedKey = (message, contactId, callback) => {
                const contact = node.getContact(contactId);
                node.send('kad-send-encrypted-key', { message }, [contactId, contact], callback);
            };

            node.verifyImport = (message, contactId, callback) => {
                const contact = node.getContact(contactId);
                node.send('kad-verify-import-request', { message }, [contactId, contact], callback);
            };

            node.sendVerifyImportResponse = (message, contactId, callback) => {
                const contact = node.getContact(contactId);
                node.send('kad-verify-import-response', { message }, [contactId, contact], callback);
            };
        });
        // Define a global custom error handler rule
        this.node.use((err, request, response, next) => {
            this.log.warn(`KADemlia error. ${err}. Request: ${request}.`);
            response.send({ error: err.message });
        });
    }

    kademlia() {
        return this.node;
    }
}

module.exports = Network;
