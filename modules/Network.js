process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const log = require('./Utilities').getLogger();
const levelup = require('levelup');
const sqldown = require('sqldown');
const encoding = require('encoding-down');
const kadence = require('@kadenceproject/kadence');
const config = require('./Config');
const async = require('async');
const deasync = require('deasync-promise');
const fs = require('fs');
var node = require('./Node');
const NetworkUtilities = require('./NetworkUtilities');
const utilities = require('./Utilities');
const globalEvents = require('./GlobalEvents');

const { globalEmitter } = globalEvents;
var ns = {};


/**
 * DHT module (Kademlia)
 */

class Network {
    /**
   * Setup options and construct a node
   */
    constructor() {
        kadence.constants.T_RESPONSETIMEOUT = 20000;
        kadence.constants.K = 20;
        if (parseInt(config.test_network, 10)) {
            kadence.constants.IDENTITY_DIFFICULTY = 2;
            kadence.constants.SOLUTION_DIFFICULTY = 2;
        }
        ns = new NetworkUtilities();
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
        ns.verifyConfiguration(config);


        log.info('Checking SSL certificate');
        deasync(ns.setSelfSignedCertificate(config));

        log.info('Getting the identity');
        this.xprivkey = fs.readFileSync(`${__dirname}/../keys/${config.private_extended_key_path}`).toString();
        this.identity = new kadence.eclipse.EclipseIdentity(this.xprivkey, this.index);


        log.info('Checking the identity');
        // Check if identity is valid ?
        ns.checkIdentity(this.identity, this.xprivkey);

        const { childkey, parentkey } = ns.getIdentityKeys(this.xprivkey);


        this.identity = kadence.utils.toPublicKeyHash(childkey.publicKey)
            .toString('hex');

        log.notify(`My identity: ${this.identity}`);
        config.identity = this.identity;

        log.info('Initializing network');

        // Initialize public contact data
        const contact = this.setContact(config, parentkey);

        const transport = this._HTTPSTransport();

        // Initialize protocol implementation
        node.ot = new kadence.KademliaNode({
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

        // We use Hashcash for relaying messages to prevent abuse and make large scale
        // DoS and spam attacks cost prohibitive
        node.ot.hashcash = node.ot.plugin(kadence.hashcash({
            methods: ['PUBLISH', 'SUBSCRIBE', 'payload-sending'],
            difficulty: 10,
        }));
        log.info('Hashcash initialised');

        // Use Tor for an anonymous overlay
        if (parseInt(config.onion_enabled, 10)) {
            // noinspection JSAnnotator
            kadence.constants.T_RESPONSETIMEOUT = 20000;
            node.ot.onion = node.plugin(kadence.onion({
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

        if (parseInt(config.traverse_nat_enabled, 10)) {
            log.info('Trying NAT traversal');
            node.ot.traverse = node.ot.plugin(kadence.traverse([
                new kadence.traverse.UPNPStrategy({
                    mappingTtl: parseInt(config.traverse_port_forward_ttl, 10),
                    publicPort: parseInt(node.ot.contact.port, 10),
                }),
                new kadence.traverse.NATPMPStrategy({
                    mappingTtl: parseInt(config.traverse_port_forward_ttl, 10),
                    publicPort: parseInt(node.ot.contact.port, 10),
                }),
            ]));
        }

        this.registerRoutes();

        // Use verbose logging if enabled
        if (parseInt(config.verbose_logging, 10)) {
            node.ot.rpc.deserializer.append(new kadence.logger.IncomingMessage(log));
            node.ot.rpc.serializer.prepend(new kadence.logger.OutgoingMessage(log));
        }
        // Cast network nodes to an array
        if (typeof config.network_bootstrap_nodes === 'string') {
            config.network_bootstrap_nodes = config.network_bootstrap_nodes.trim().split();
        }

        node.ot.listen(parseInt(config.node_port, 10), () => {
            log.notify('OT Node listening ' +
          `at https://${node.ot.contact.hostname}:${node.ot.contact.port}`);
            ns.registerControlInterface(config, node);

            if (parseInt(config.solve_hashes, 10)) {
                ns.spawnHashSolverProcesses();
            }

            async.retry({
                times: Infinity,
                interval: 60000,
            }, done => this.joinNetwork(done), (err, entry) => {
                if (err) {
                    log.error(err.message);
                    process.exit(1);
                }

                log.info(`Connected to network via ${entry[0]} ` +
              `(https://${entry[1].hostname}:${entry[1].port})`);
                log.info(`Discovered ${node.ot.router.size} peers from seed`);
            });
        });
    }


    /**
   * Set contact data
   * @param config
   * @param parentkey
   * @return {{hostname: *, protocol: string, port: number, xpub: *, index: number, agent: string}}
   */
    setContact(config, parentkey) {
        const contact = {
            hostname: config.node_rpc_ip,
            protocol: 'https:',
            port: parseInt(config.node_port, 10),
            xpub: parentkey.publicExtendedKey,
            index: parseInt(config.child_derivation_index, 10),
            agent: kadence.version.protocol,
            wallet: config.node_wallet,
        };
        return contact;
    }

    /**
   * HTTPS Transport
   * @param config
   * @return {HTTPSTransport}
   * @private
   */
    _HTTPSTransport() {
        const key = fs.readFileSync(`${__dirname}/../keys/${config.ssl_keypath}`);
        const cert = fs.readFileSync(`${__dirname}/../keys/${config.ssl_certificate_path}`);
        const ca = config.ssl_authority_paths.map(fs.readFileSync);

        // Initialize transport adapter
        const transport = new kadence.HTTPSTransport({ key, cert, ca });

        return transport;
    }

    /**
     * Join network
   */
    joinNetwork(callback) {
        const peers = config.network_bootstrap_nodes;
        if (peers.length === 0) {
            log.warn('No bootstrap seeds provided and no known profiles');
            log.trace('Running in seed mode (waiting for connections)');
            return node.ot.router.events.once('add', (identity) => {
                config.network_bootstrap_nodes = [
                    kadence.utils.getContactURL([
                        identity,
                        node.ot.router.getContactByNodeId(identity),
                    ]),
                ];
                this.joinNetwork(callback);
            });
        }

        log.info(`Joining network from ${peers.length} seeds`);
        async.detectSeries(peers, (url, done) => {
            const contact = kadence.utils.parseContactURL(url);
            node.ot.join(contact, (err) => {
                done(null, (!err) && node.ot.router.size >= 1);
            });
        }, (err, result) => {
            if (!result) {
                log.error('Failed to join network, will retry in 1 minute. Bootstrap node is probably not online.');
                callback(new Error('Failed to join network'));
            } else {
                log.important('Joined the network');
                /* eslint-disable-next-line no-undef */
                const contact = kadence.utils.parseContactURL(result);
                config.dh = contact;
                callback(null, contact);
            }
        });
    }

    registerRoutes() {
        node.ot.use('payload-request', (request, response, next) => {
            log.info('payload-request received');
            globalEmitter.emit('payload-request', request, response);
            response.send({
                status: 'OK',
            });
        });
        node.ot.use('replication-finished', (request, response, next) => {
            log.info('replication-finished received');
            globalEmitter.emit('replication-finished', request);
            response.send({
                status: 'OK',
            });
        });
        node.ot.use('challenge-request', (request, response, next) => {
            log.info('challenge-request received');
            globalEmitter.emit('kad-challenge-request', request, response);
        });


        node.ot.use('payload-request', (err, request, response, next) => {
            response.send({
                error: 'error',
            });
        });
        node.ot.use('replication-finished', (err, request, response, next) => {
            response.send({
                error: 'error',
            });
        });
        node.ot.plugin((node) => {
            node.getNearestNeighbour = () =>
                [...node.router.getClosestContactsToKey(this.identity).entries()].shift();

            node.payloadRequest = (message, callback) => {
                const neighbor = [
                    ...node.router.getClosestContactsToKey(this.identity).entries(),
                ].shift();
                node.send('payload-request', { message }, neighbor, callback);
            };
            node.replicationFinished = (message, callback) => {

            };
            node.challengeRequest = (message, contactId, callback) => {
                const contact = node.router.getContactByNodeId(contactId);
                node.send('challenge-request', { message }, [contactId, contact], callback);
            };
        });
        // Define a global custom error handler rule, simply by including the `err`
        // argument in the handler
        node.ot.use((err, request, response, next) => {
            response.send({ error: err.message });
        });
    }
}

module.exports = Network;
