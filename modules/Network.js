process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const log = require('./Utilities').getLogger();
const levelup = require('levelup');
const leveldown = require('leveldown');
const sqldown = require('sqldown');
const encoding = require('encoding-down');
const kadence = require('../@kadenceproject/kadence');
const config = require('./Config');
const async = require('async');
const deasync = require('deasync-promise');
const fs = require('fs');
var node = require('./Node');
const NetworkUtilities = require('./NetworkUtilities');
const utilities = require('./Utilities');
const MessageHandler = require('./MessageHandler');
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
        kadence.constants.IDENTITY_DIFFICULTY = 2;
        kadence.constants.SOLUTION_DIFFICULTY = 2;
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
        // const transport = new kadence.HTTPTransport();
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
        // node.ot.hashcash = node.ot.plugin(kadence.hashcash({
        //     methods: ['PUBLISH', 'SUBSCRIBE', 'payload-sending'],
        //     difficulty: 10,
        // }));

        log.info('Hashcash initialised');
        // Quasar - A Probabilistic Publish-Subscribe System
        // node.ot.quasar = node.ot.plugin(kadence.quasar());

        // Mitigate Eclipse attacks
        // node.ot.eclipse = node.ot.plugin(kadence.eclipse());
        log.info('Eclipse protection initialised');

        // Mitigate Spartacus attacks - Sybil
        // node.ot.spartacus = node.ot.plugin(kadence.spartacus(
        //     this.xprivkey,
        //     parseInt(config.child_derivation_index, 10),
        //     kadence.constants.HD_KEY_DERIVATION_PATH,
        // ));

        log.info('Spartacus initialised');

        // node.ot.permission = node.ot.plugin(kadence.permission({
        //     privateKey: node.ot.spartacus.privateKey,
        //     walletPath: `${__dirname}/../data/wallet.dat`,
        // }));

        // Store peers in cache
        // node.ot.rolodex = node.ot.plugin(kadence.rolodex(`${__dirname}/../data/${config.embedded_peercache_path}`));

        log.info('Validating solutions in wallet, this can take some time');
        // await node.ot.wallet.validate();

        // Hibernate when bandwidth thresholds are reached
        // node.ot.hibernate = node.ot.plugin(kadence.hibernate({
        //     limit: config.BandwidthAccountingMax,
        //     interval: config.BandwidthAccountingReset,
        //     reject: ['FIND_VALUE', 'STORE'],
        // }));

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

        // Handle any fatal errors
        node.ot.on('error', (err) => {
            log.error(err.message.toLowerCase());
        });

        // Use verbose logging if enabled
        if (parseInt(config.verbose_logging, 10)) {
            node.ot.rpc.deserializer.append(new kadence.logger.IncomingMessage(log));
            node.ot.rpc.serializer.prepend(new kadence.logger.OutgoingMessage(log));
        }
        // Cast network nodes to an array
        if (typeof config.network_bootstrap_nodes === 'string') {
            // https://127.0.0.1:8000/#ea48d3f07a5241291ed0b4cab6483fa8b8fcc123
            config.network_bootstrap_nodes = config.network_bootstrap_nodes.trim().split();
        }

        node.ot.listen(parseInt(config.node_port, 10), () => {
            log.notify('OT Node listening ' +
          `at https://${node.ot.contact.hostname}:${node.ot.contact.port}`);
            ns.registerControlInterface(config, node);

            if (parseInt(config.solve_hashes, 10)) {
                ns.spawnHashSolverProcesses();
            }

            node.ot.use('payload-sending', function(request, response, next) {
                let [message] = request.params;
                console.log('Stigla poruka: ');
                console.log(message);

                if (!message) {
                    return next(new Error('Nothing to echo')); // Exit to the error stack
                }

                response.send([message]); // Respond back with the argument provided
            });
            // if bootstrap node, don't join just wait and listen in seed mode
            if (!parseInt(config.is_bootstrap_node, 10)) {
                async.retry({
                    times: Infinity,
                    interval: 10000,
                }, done => this.joinNetwork(done), (err, entry) => {
                    if (err) {
                        log.error(err.message);
                        process.exit(1);
                    }

                    log.info(`Connected to network via ${entry[0]} ` +
              `(https://${entry[1].hostname}:${entry[1].port})`);
                    log.info(`Discovered ${node.ot.router.size} peers from seed`);

                    // MessageHandler.onBroadcastMessage('replication-request').then((payload) => {
                    //     // don't send replication request to yourself
                    //     if (payload.identity !== this.identity) {
                    //         log.important(`New replication request received from ${payload.identity}`);
                    //         globalEmitter.emit('replication-request', payload);
                    //     }
                    // }).catch((e) => {
                    //     console.log(e);
                    // });

                    console.log(this.identity);
                    console.log(node.ot.identity.toString('hex'));
                    setTimeout(() => {
                        if(this.identity === "b1b97e15976587d893af72a849034aba9a0dd90f") {
                            console.log('JA SALJEM');
                            node.ot.send('payload-sending', ['some message'], ['80ca7a0771c118f2d45c4624884682c547c33ba4',
                                {
                                    hostname: '167.99.202.146',
                                    protocol: 'https:',
                                    port: 5278,
                                    xpub: 'xpub6ABpFrTAJj3DAYaZLgF3c4jzU2cud6y48SxUuALQaFAKLAa2BMJBN2AkwxkpRm4HAeeMMfS2E29FHzpfA2UeRWDti5cQ25dKtJQJeSBWxqp',
                                    index: 1,
                                    agent: '1.0.0'
                                }], (err, resp) => {
                                console.log(resp)
                            });
                        }
                    }, 10000);

                    // MessageHandler.onDirectMessage('payload-request')
                    //     .then((payload) => {
                    //         globalEmitter.emit('payload-request', payload);
                    //     })
                    //     .catch((e) => {
                    //         console.log(e);
                    //     });
                    //
                    // MessageHandler.onDirectMessage('replication-finished')
                    //     .then((status) => {
                    //         globalEmitter.emit('replication-finished', status);
                    //     })
                    //     .catch((e) => {
                    //         console.log(e);
                    //     });
                    //
                    // MessageHandler.onDirectMessage('challenge-request')
                    //     .then((payload) => {
                    //         globalEmitter.emit('challenge-request', payload);
                    //     })
                    //     .catch((e) => {
                    //         console.log(e);
                    //     });
                });
            }
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
        };
        console.log(contact)
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
   * Join Network
   * @param callback
   * @return {Promise<void>}
   */
    async joinNetwork(callback) {
        // const peers
        // = config
        //    .network_bootstrap_nodes.concat(await node.ot.rolodex.getBootstrapCandidates());

        const peers = config.network_bootstrap_nodes;
        if (peers.length === 0) {
            log.warn('No bootstrap seeds provided and no known profiles');
            log.trace('Running in seed mode (waiting for connections)');
            return node.ot.router.events.once('add', (identity) => {
                console.log(identity);
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
                done(null, (!err) && node.ot.router.size > 1);
            });
        }, (err, result) => {
            if (!result) {
                log.error('Failed to join network, will retry in 1 minute');
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
}


module.exports = Network;
