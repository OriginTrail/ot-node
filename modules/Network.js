// start(...)
// connectToSeed(...)
// sendBroadcast(...)
// sendDirectMessage(...)
// onDirectMessage(...)
// broadcastMessage(...)
// onBroadcastMessage(...)


const log = require('./utilities').getLogger();
const levelup = require('levelup');
const encoding = require('encoding-down');
const leveldown = require('leveldown');
const kadence = require('@kadenceproject/kadence');

const async = require('async');
var { node } = require('./Node');

const fs = require('fs');


const NetworkUtilities = require('./NetworkUtilities');

var ns = {};

const utilities = require('./utilities');

// TODO: change it for sqlite
const storage = levelup(encoding(leveldown('kad-storage/storage.db')));

/**
 * DHT module (Kademlia)
 */

class Network {
    /**
   * Setup options and construct a node
   */
    constructor(config) {
        this.config = config;
        ns = new NetworkUtilities(config);
        this.index = parseInt(config.child_derivation_index, 10);

        // Initialize private extended key
        utilities.createPrivateExtendedKey(config, kadence);
    }

    /**
    * Starts the node
    * @return {Promise<void>}
    */
    async start() {
        const { config } = this;

        // Check config
        ns.verifyConfiguration(config);

        log.info('Checking SSL certificate');
        ns.setSelfSignedCertificate(config);

        log.info('Getting the identity');
        this.xprivkey = fs.readFileSync(`${__dirname}/../keys/${this.config.private_extended_key_path}`).toString();
        this.identity = new kadence.eclipse.EclipseIdentity(this.xprivkey, this.index);


        log.info('Checking the identity');
        // Check if identity is valid ?
        ns.checkIdentity(this.identity, this.xprivkey);

        const { childkey, parentkey } = ns.getIdentityKeys(this.xprivkey);
        this.identity = kadence.utils.toPublicKeyHash(childkey.publicKey)
            .toString('hex');

        log.info(`My identity: ${this.identity}`);
        log.info('Initializing network');

        // Initialize public contact data
        const contact = this.setContact(config, parentkey);

        const transport = this._HTTPSTransport(config);
        // const transport = new kadence.HTTPTransport();
        // Initialize protocol implementation
        node = new kadence.KademliaNode({
            log,
            transport,
            contact,
            storage: levelup(encoding(leveldown(`${__dirname}/../kad-storage/kadence.dht`))),
        });

        log.info('Starting OT Node...');

        // We use Hashcash for relaying messages to prevent abuse and make large scale
        // DoS and spam attacks cost prohibitive
        node.hashcash = node.plugin(kadence.hashcash({
            methods: ['PUBLISH', 'SUBSCRIBE'],
            difficulty: 2,
        }));

        log.info('Hashcach initialised');
        // Quasar - A Probabilistic Publish-Subscribe System
        node.quasar = node.plugin(kadence.quasar());

        // Mitigate Spartacus attacks - Sybil
        node.spartacus = node.plugin(kadence.spartacus(
            this.xprivkey,
            parseInt(config.child_derivation_index, 10),
            kadence.constants.HD_KEY_DERIVATION_PATH,
        ));

        log.info('Spartacus initialised');


        // Mitigate Eclipse attacks
        // node.eclipse = node.plugin(kadence.eclipse());
        log.info('Eclipse protection initialised');

        // node.permission = node.plugin(kadence.permission({
        //     privateKey: node.spartacus.privateKey,
        //     walletPath: `${__dirname}/../data/wallet.dat`,
        // }));

        // Store peers in cache
        node.rolodex = node.plugin(kadence.rolodex(`${__dirname}/../data/${config.embedded_peercache_path}`));

        // log.info('Validating solutions in wallet, this can take some time');
        // await node.wallet.validate();

        // Hibernate when bandwidth thresholds are reached
        // node.hibernate = node.plugin(kadence.hibernate({
        //     limit: config.BandwidthAccountingMax,
        //     interval: config.BandwidthAccountingReset,
        //     reject: ['FIND_VALUE', 'STORE'],
        // }));

        // Use Tor for an anonymous overlay
        // if (parseInt(config.onion_enabled, 10)) {
        //     kadence.constants.T_RESPONSETIMEOUT = 20000;
        //     node.onion = node.plugin(kadence.onion({
        //         dataDirectory: `${__dirname}/../hidden_service`,
        //         virtualPort: config.onion_virtual_port,
        //         localMapping: `127.0.0.1:${config.node_kademlia_port}`,
        //         torrcEntries: {
        //             CircuitBuildTimeout: 10,
        //             KeepalivePeriod: 60,
        //             NewCircuitPeriod: 60,
        //             NumEntryGuards: 8,
        //             Log: 'notice stdout',
        //         },
        //         passthroughLoggingEnabled: 1,
        //     }));
        // }

        if (parseInt(config.traverse_nat_enabled, 10)) {
            log.info('Trying NAT traversal');
            node.traverse = node.plugin(kadence.traverse([
                new kadence.traverse.UPNPStrategy({
                    mappingTtl: parseInt(config.traverse_port_forward_ttl, 10),
                    publicPort: parseInt(node.contact.port, 10),
                }),
                new kadence.traverse.NATPMPStrategy({
                    mappingTtl: parseInt(config.traverse_port_forward_ttl, 10),
                    publicPort: parseInt(node.contact.port, 10),
                }),
            ]));
        }

        // Handle any fatal errors
        node.on('error', (err) => {
            log.error(err.message.toLowerCase());
        });

        // Use verbose logging if enabled
        if (parseInt(config.verbose_logging, 10)) {
            node.rpc.deserializer.append(new kadence.logger.IncomingMessage(log));
            node.rpc.serializer.prepend(new kadence.logger.OutgoingMessage(log));
        }
        // Cast network nodes to an array
        if (typeof config.network_bootstrap_nodes === 'string') {
            // https://127.0.0.1:8000/#ajsdlkasjdklasjkldjklasj
            config.network_bootstrap_nodes = config.network_bootstrap_nodes.trim().split();
        }

        // Use "global" rules for preprocessing *all* incoming messages
        // This is useful for things like blacklisting certain nodes
        // node.use((request, response, next) => {
        //     console.log('stiglo nesto');
        //     console.log(JSON.stringify(request));
        //     const [identityString] = request.contact;
        //     console.log(response);
        //
        //     if ([/* identity blacklist */].includes(identityString)) {
        //         return next(new Error('You have been blacklisted'));
        //     }
        //
        //     next();
        // });

        node.use((request, response, next) => {
            if (request.method == 'ECHO') {
                console.log(JSON.stringify(request));
                response.send( request.params);
            }
            next();
        });
        node.use('ECHO', (err, request, response, next) => {
            console.log(request.params.message);
        });


        node.listen(parseInt(config.node_kademlia_port, 10), () => {
            log.info(`Node listening on local port ${config.node_kademlia_port} ` +
                `and exposed at https://${node.contact.hostname}:${node.contact.port}`);
            // ns.registerControlInterface(config, node);
            // if (config.solve_hashes) {
            //     ns.spawnHashSolverProcesses();
            // }
            // async.retry({
            //     times: Infinity,
            //     interval: 1000,
            // }, done => this.joinNetwork(done), (err, entry) => {
            //     if (err) {
            //         log.error(err.message);
            //         process.exit(1);
            //     }
            //
            //     log.info(`Connected to network via ${entry[0]} ` +
            //         `(http://${entry[1].hostname}:${entry[1].port})`);
            //     log.info(`Discovered ${node.router.size} peers from seed`);
            // });
        });

        // this.node.plugin(kadence.quasar());
        //
        //
        // node.listen(this.config.node_kademlia_port);
        // log.info(`Listening on port ${this.config.node_kademlia_port}`);


        // node.join(['ea48d3f07a5241291ed0b4cab6483fa8b8fcc123', {
        //     hostname: 'localhost',
        //     port: this.config.node_kademlia_port,
        // }], () => {
        // Add 'join' callback which indicates peers were discovered and
        // our node is now connected to the overlay network
        //     log.info(`Connected to ${node.router.length} peers!`);

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
            port: parseInt(config.node_kademlia_port, 10),
            xpub: parentkey.publicExtendedKey,
            index: parseInt(config.child_derivation_index, 10),
            agent: kadence.version.protocol,
        };
        return contact;
    }

    /**
    * HTTPS Transport
    * @param config
    * @return {HTTPSTransport}
    * @private
    */
    _HTTPSTransport(config) {
        const key = fs.readFileSync(`${__dirname}/../keys/${config.ssl_key_path}`);
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
        var { config } = this;

        const peers
            = this.config.network_bootstrap_nodes.concat(await node.rolodex.getBootstrapCandidates());

        if (peers.length === 0) {
            log.info('No bootstrap seeds provided and no known profiles');
            log.info('Running in seed mode (waiting for connections)');

            return node.router.events.once('add', (identity) => {
                console.log('identity');
                console.log(identity);
                this.config.network_bootstrap_nodes = [
                    kadence.utils.getContactURL([
                        identity,
                        node.router.getContactByNodeId(identity),
                    ]),
                ];
                this.joinNetwork(callback);
            });
        }

        log.info(`Joining network from ${peers.length} seeds`);
        async.detectSeries(peers, (url, done) => {
            const contact = kadence.utils.parseContactURL(url);
            node.join(contact, (err) => {
                done(null, (!err) && node.router.size > 1);
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

