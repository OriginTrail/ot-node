process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const async = require('async');
const levelup = require('levelup');
const encoding = require('encoding-down');
const kadence = require('@deadcanaries/kadence');
const fs = require('fs');
const path = require('path');
const utilities = require('../../Utilities');
const _ = require('lodash');
const sleep = require('sleep-async')().Promise;
const leveldown = require('leveldown');
const ip = require('ip');
const uuidv4 = require('uuid/v4');
const secp256k1 = require('secp256k1');
const homeDir = require('os').homedir();

const KadenceUtils = require('@deadcanaries/kadence/lib/utils.js');
const { IncomingMessage, OutgoingMessage } = require('./logger');

const pjson = require('../../../package.json');

const { NetworkRequestIgnoredError } = require('../../errors/index');


const { lstatSync, readdirSync } = require('fs');
const { join, basename, parse } = require('path');

/**
 * DHT module (Kademlia)
 */
class Kademlia {
    /**
     * Setup options and construct a node
     */
    constructor(ctx) {
        this.log = ctx.logger;
        this.emitter = ctx.emitter;
        this.kademliaUtilities = ctx.kademliaUtilities;
        this.notifyError = ctx.notifyError;
        this.config = ctx.config;
        this.approvalService = ctx.approvalService;

        kadence.constants.T_RESPONSETIMEOUT = this.config.request_timeout;
        kadence.constants.ALPHA = kadence.constants.K + 1;
        kadence.constants.SOLUTION_DIFFICULTY = this.config.network.solutionDifficulty;
        kadence.constants.IDENTITY_DIFFICULTY = this.config.network.identityDifficulty;
        kadence.constants.ALPHA = kadence.constants.K + 1;
        this.log.info(`Network solution difficulty ${kadence.constants.SOLUTION_DIFFICULTY}.`);
        this.log.info(`Network identity difficulty ${kadence.constants.IDENTITY_DIFFICULTY}.`);
    }

    /**
     * Initializes keys
     * @return {Promise<void>}
     */
    async initialize() {
        // Check config
        this.kademliaUtilities.verifyConfiguration(this.config);

        this.log.info('Checking SSL certificate');
        await this.kademliaUtilities.setSelfSignedCertificate();

        this.log.info('Getting the identity');
        const identityFilePath = path.join(
            this.config.appDataPath,
            this.config.identity_filepath,
        );

        if (fs.existsSync(identityFilePath)) {
            this.log.info('Using existing identity...');
            const identityFileContent =
                JSON.parse(fs.readFileSync(identityFilePath).toString());
            this.privateKey = Buffer.from(identityFileContent.privateKey, 'hex');
            this.nonce = identityFileContent.nonce;
            this.proof = Buffer.from(identityFileContent.proof, 'hex');
        } else {
            this.log.info('Identity not provided, generating new one...');
            this.privateKey = kadence.utils.generatePrivateKey();
            this._saveIdentityToFile(this.privateKey.toString('hex'));
        }
        const publicKey = secp256k1.publicKeyCreate(this.privateKey);
        this.identity = new kadence.eclipse.EclipseIdentity(
            publicKey,
            this.nonce,
            this.proof,
        );

        // If identity is not solved yet, start trying to solve it
        if (!this.identity.validate()) {
            this.log.info('identity proof not yet solved, this can take a while');
            await this.identity.solve();
            this._saveIdentityToFile(
                this.privateKey.toString('hex'),
                this.identity.nonce,
                this.identity.proof.toString('hex'),
            );
        }

        this.config.identity = this.identity.fingerprint.toString('hex');

        this.log.notify(`My network identity: ${this.config.identity}`);

        const fingerprintFIle = path.join(
            this.config.appDataPath,
            'fingerprint.json',
        );

        if (fs.existsSync(fingerprintFIle)) {
            fs.unlinkSync(fingerprintFIle);
        }

        fs.writeFileSync(fingerprintFIle, `{"identity":"${this.config.identity}"}`);

        if (!fs.existsSync(`${homeDir}/kademlia`)) { fs.mkdirSync(`${homeDir}/kademlia`); }
        if (!fs.existsSync(`${homeDir}/kademlia/logs`)) { fs.mkdirSync(`${homeDir}/kademlia/logs`); }
    }

    /**
     * Starts the node
     * @return {Promise<void>}
     */
    start() {
        return new Promise(async (resolve) => {
            this.log.info('Initializing network');

            const { hostname } = this.config.network;
            if (!this.config.local_network_only && !this.config.traverse_nat_enabled) {
                if (ip.isPrivate(hostname) || hostname === 'localhost') {
                    throw Error('Please set node\'s hostname (address) ' +
                        'to something publicly visible.');
                }
            }

            // Initialize public contact data
            const contact = {
                hostname,
                protocol: 'https:',
                port: this.config.node_port,
                // agent: kadence.version.protocol,
                wallet: this.config.node_wallet,
                network_id: this.config.network.id,
                identity: this.config.identity,
            };

            const { key, cert } = this.kademliaUtilities.getCertificates();
            const ca = this.config.ssl_authority_paths.map(fs.readFileSync);

            // Initialize transport adapter
            const transport = new kadence.HTTPSTransport({ key, cert, ca });
            // const transport = new kadence.HTTPTransport();
            // Initialize protocol implementation
            this.node = new kadence.KademliaNode({
                logger: this.log,
                transport,
                contact,
                identity: this.config.identity,
                storage: levelup(encoding(leveldown(path.join(this.config.appDataPath, 'kadence.dht')))),
            });


            this.log.info('Starting OT Node...');
            this.node.hashcash = this.node.plugin(kadence.hashcash({
                methods: [
                    'kad-data-location-request',
                    'kad-replication-finished', 'kad-data-location-response', 'kad-data-read-request',
                    'kad-data-read-response', 'kad-send-encrypted-key',
                    'kad-encrypted-key-process-result',
                    'kad-replication-request', 'kad-replacement-replication-request', 'kad-replacement-replication-finished',
                ],
                difficulty: this.config.network.solutionDifficulty,
            }));
            this.log.info('Hashcash initialised');

            this.node.quasar = this.node.plugin(kadence.quasar());
            this.node.quasar.appDataPath = this.config.appDataPath;

            this.log.info('Quasar initialised');

            const spartacusPlugin = kadence.spartacus(
                this.privateKey,
                this.node.identity,
                { checkPublicKeyHash: false },
            );
            this.node.spartacus = this.node.plugin(spartacusPlugin);

            this.node.identity = this.config.identity;
            this.node.router.identity = this.config.identity;
            this.node.spartacus.identity = this.config.identity;


                this.log.info('Spartacus initialised');

            this.node.content = this.node.plugin(kadence.contentaddress({ valueEncoding: 'hex' }));
            this.log.info('Content initialised');

            this.node.eclipse = this.node.plugin(kadence.eclipse(this.identity));
            this.log.info('Eclipse initialised');

            const peerCacheFilePath = path.join(
                this.config.appDataPath,
                this.config.embedded_peercache_path,
            );

            if (!fs.existsSync(peerCacheFilePath)) {
                fs.writeFileSync(peerCacheFilePath, '{}');
            }

            this.node.rolodex = this.node.plugin(kadence.rolodex(peerCacheFilePath));
            this.log.info('Rolodex initialised');

            // Override node's _updateContact method to filter contacts.
            // this.node._updateContact = (identity, contact) => {
            //     try {
            //         if (!this.validateContact(identity, contact)) {
            //             this.log.debug(`Ignored contact ${identity}. Hostname ${contact.hostname}. Network ID ${contact.network_id}.`);
            //             return;
            //         }
            //     } catch (err) {
            //         this.log.debug(`Failed to filter contact(${identity}, ${contact}). ${err}.`);
            //         return;
            //     }
            //
            //     // Simulate node's "super._updateContact(identity, contact)".
            //     this.node.constructor.prototype.constructor.prototype
            //         ._updateContact.call(this.node, identity, contact);
            // };

            this.node.use((request, response, next) => {
                if (!this.validateContact(request.contact[0], request.contact[1])) {
                    return next(new NetworkRequestIgnoredError('Contact not valid.', request));
                }
                next();
            });

            // this.node.blacklist = this.node.plugin(kadence.churnfilter({
            //     cooldownBaseTimeout: this.config.network.churnPlugin.cooldownBaseTimeout,
            //     cooldownMultiplier:
            //         parseInt(this.config.network.churnPlugin.cooldownMultiplier, 10),
            //     cooldownResetTime: this.config.network.churnPlugin.cooldownResetTime,
            // }));
            if (this.config.traverse_nat_enabled) {
                this.enableNatTraversal();
            }

            // Use verbose logging if enabled
            if (process.env.LOGS_LEVEL_DEBUG) {
                this.node.rpc.deserializer.append(() => new IncomingMessage(this.log));
                this.node.rpc.serializer.prepend(() => new OutgoingMessage(this.log));
            }
            // Cast network nodes to an array
            if (typeof this.config.network.bootstraps === 'string') {
                this.config.network.bootstraps =
                    this.config.network.bootstraps.trim().split();
            }

            this._registerRoutes();

            this.node.listen(this.config.node_port, () => {
                this.log.notify(`OT Node listening at https://${this.node.contact.hostname}:${this.node.contact.port}`);
                this.kademliaUtilities.registerControlInterface(this.config, this.node);

                async.retry({
                    times: Infinity,
                    interval: 60000,
                }, done => this.joinNetwork(done), (err, entry) => {
                    if (err) {
                        this.log.error(`Failed to join network ${err}`);
                        this.notifyError(err);
                        process.exit(1);
                    }

                    if (entry) {
                        this.log.info(`connected to network via ${entry}`);
                        this.log.info(`discovered ${this.node.router.size} peers from seed`);
                    }
                    resolve();
                });
            });
        });
    }

    enableNatTraversal() {
        this.log.info('Trying NAT traversal');

        const remoteAddress = this.config.reverse_tunnel_address;
        const remotePort = this.config.reverse_tunnel_port;

        this.node.traverse = this.node.plugin(kadence.traverse([
            new kadence.traverse.ReverseTunnelStrategy({
                remotePort,
                remoteAddress,
                privateKey: this.node.spartacus.privateKey,
                secureLocalConnection: true,
                verboseLogging: false,
            }),
        ]));
    }

    /**
     * Try to join network
     * Note: this method tries to find possible bootstrap nodes
     */
    async joinNetwork(callback) {
        const peers = Array.from(new Set(this.config.network.bootstraps
            .concat(await this.node.rolodex.getBootstrapCandidates())));

        if (peers.length === 0) {
            this.log.info('no bootstrap seeds provided and no known profiles');
            this.log.info('running in seed mode (waiting for connections)');

            callback(null, null);

            return this.node.router.events.once('add', (identity) => {
                this.config.network.bootstraps = [
                    kadence.utils.getContactURL([
                        identity,
                        this.node.router.getContactByNodeId(identity),
                    ]),
                ];
                this.joinNetwork(callback);
            });
        }

        this.log.info(`joining network from ${peers.length} seeds`);
        async.detectSeries(peers, (url, done) => {
            console.log(`Joining ${url}`);
            const contact = kadence.utils.parseContactURL(url);
            this.node.join(contact, (err) => {
                done(null, (!err) && this.node.router.size > 0);
            });
        }, (err, result) => {
            if (!result) {
                this.log.error('failed to join network, will retry in 1 minute');
                callback(new Error('Failed to join network'));
            } else {
                callback(null, result);
            }
        });
    }

    /**
     * Returns if we consider we are connected to the network
     * @return {boolean}
     * @private
     */
    _isConnected() {
        return this.node.router.size > 0;
    }

    /**
     * Register Kademlia routes and error handlers
     */
    _registerRoutes() {
        if (this.config.is_bootstrap_node) {
            // TODO: add here custom methods for bootstrap.

            return;
        }

        this.node.quasar.quasarSubscribe('kad-data-location-request', (message, err) => {
            this.log.info('New location request received');
            this.emitter.emit('kad-data-location-request', message);
        });

        this.node.quasar.quasarSubscribe('kad-broadcast-request', async (message, err) => {
            this.log.info('Broadcast request received');
            this.log.info(`ALPHA is ${kadence.constants.ALPHA}.`);
            this.log.info(`MAX_RELAY_HOPS is ${kadence.constants.MAX_RELAY_HOPS}.`);
            const contact = await this.node.getContact(message.nodeId);
            const myIdentity = this.node.identity.toString('hex');
            return new Promise((resolve, reject) => {
                this.node.send('kad-broadcast-response', { myIdentity, broadcastDir: JSON.stringify(message.broadcastDir) }, [message.nodeId, contact], (err, res) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(res);
                    }
                });
            });
        });

        this.node.use('kad-ping-request', (request, response, next) => {
            response.send([]);
            console.log('It is me!');
        });

        this.node.use('kad-ping-response', (request, response, next) => {
            response.send([]);
            const message = JSON.parse(request.params.message);
            const ultimateContactId = message.to;
            const originContactId = message.from;
            message.ttl -= 1;
            if (message.ttl > 0) {
                this.log.info(`Ping response received for ${originContactId}`);
                if (originContactId.toLowerCase() === this.node.identity.toString('hex').toLowerCase()) {
                    console.log(`Ping found: ${ultimateContactId}`);
                    const isDirectory = source => lstatSync(source).isDirectory();
                    const getDirectories = source => readdirSync(source).map(name => join(source, name)).filter(isDirectory);
                    const broadcastDir = (getDirectories(`${homeDir}/kademlia/logs/`).sort()).slice(-1)[0];

                    const pingArray = JSON.parse(fs.readFileSync(`${broadcastDir}/ping.json`));
                    pingArray.push(ultimateContactId);
                    fs.writeFileSync(`${broadcastDir}/ping.json`, JSON.stringify(pingArray));
                } else {
                    return new Promise(async (resolve, reject) => {
                        const contact = await this.node.getContact(originContactId);
                        console.log(`Forwarding to ${contact[0]}`);
                        if ((contact[0]).toLowerCase() !== this.node.identity.toString('hex').toLowerCase() && contact[0] === contact[1].identity) {
                            this.node.send('kad-ping-response', { message: JSON.stringify(message) }, contact, (err, res) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve(res);
                                }
                            });
                        } else {
                            resolve();
                        }
                    });
                }
            }
        });

        this.node.use('kad-broadcast-response', (request, response, next) => {
            this.log.info(`Broadcast response received for ${request.contact[0]}`);
            const broadcastDir = JSON.parse(request.params.broadcastDir);
            const broadcastArray = JSON.parse(fs.readFileSync(`${broadcastDir}/broadcast.json`));
            broadcastArray.push(request.contact[0]);
            fs.writeFileSync(`${broadcastDir}/broadcast.json`, JSON.stringify(broadcastArray));
            response.send([]);
        });


        // sync
        this.node.use('kad-replication-request', (request, response, next) => {
            this.log.debug('kad-replication-request received');
            this.emitter.emit('kad-replication-request', request, response);
        });

        // sync
        this.node.use('kad-replacement-replication-request', (request, response, next) => {
            this.log.debug('kad-replacement-replication-request received');
            this.emitter.emit('kad-replacement-replication-request', request, response);
        });

        // async
        this.node.use('kad-replacement-replication-finished', (request, response, next) => {
            this.log.debug('kad-replacement-replication-finished received');
            this.emitter.emit('kad-replacement-replication-finished', request, response);
            response.send([]);
        });

        // async
        this.node.use('kad-replication-finished', (request, response, next) => {
            this.log.debug('kad-replication-finished received');
            this.emitter.emit('kad-replication-finished', request, response);
            response.send([]);
        });

        // async
        this.node.use('kad-data-location-response', (request, response, next) => {
            this.log.debug('kad-data-location-response received');
            this.emitter.emit('kad-data-location-response', request);
            response.send([]);
        });

        // async
        this.node.use('kad-data-read-request', (request, response, next) => {
            this.log.debug('kad-data-read-request received');
            this.emitter.emit('kad-data-read-request', request);
            response.send([]);
        });

        // async
        this.node.use('kad-data-read-response', (request, response, next) => {
            this.log.debug('kad-data-read-response received');
            this.emitter.emit('kad-data-read-response', request);
            response.send([]);
        });

        // async
        this.node.use('kad-send-encrypted-key', (request, response, next) => {
            this.log.debug('kad-send-encrypted-key received');
            this.emitter.emit('kad-send-encrypted-key', request, response);
        });

        // async
        this.node.use('kad-encrypted-key-process-result', (request, response, next) => {
            this.log.debug('kad-encrypted-key-process-result received');
            this.emitter.emit('kad-encrypted-key-process-result', request, response);
        });

        // async
        this.node.use('kad-challenge-request', (request, response, next) => {
            this.log.debug('kad-challenge-request received');
            this.emitter.emit('kad-challenge-request', request, response);
            response.send([]);
        });

        this.node.use('*', (request, response, next) => {
            if (request.params.header) {
                const header = JSON.parse(request.params.header);

                header.ttl -= 1;
                if (header.ttl > 0) {
                    this.log.info(`Request received for ${header.to}`);
                    if (header.to === this.node.identity.toString('hex').toLowerCase()) {
                        response.send([]);
                        next();
                    } else {
                        return new Promise(async (accept, reject) => {
                            const { contact, header } = await this.node.getContact(header.to);
                            console.log(`Forwarding to ${contact[0]}`);
                            this.node.send(
                                request.method,
                                { message: request.params.message, header },
                                contact,
                                (err, res) => {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        accept(res);
                                    }
                                },
                            );
                        });
                    }
                } else response.send('Message includes invalid TTL.');
            } else next();
        });

        // async
        this.node.use('kad-challenge-response', (request, response, next) => {
            this.log.debug('kad-challenge-response received');
            this.emitter.emit('kad-challenge-response', request, response);
            response.send([]);
        });

        // error handler
        this.node.use('kad-challenge-request', (err, request, response, next) => {
            response.send({
                error: 'kad-challenge-request error',
            });
        });

        // error handler
        this.node.use('kad-replication-finished', (err, request, response, next) => {
            this.log.warn(`kad-replication-finished error received. ${err}`);
            response.error(err);
        });

        // Define a global custom error handler rule
        this.node.use((err, request, response, next) => {
            if (err instanceof NetworkRequestIgnoredError.constructor) {
                this.log.debug(`Network request ignored. Contact ${JSON.stringify(request.contact)}`);
                response.send([]);
            } else if (err) {
                this.log.warn(`KADemlia error. ${err}. Request: ${request}.`);
                response.error(err.message);
            }
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
             * Get contact by Node ID
             * @param contactId
             * @returns [contactId,contact]
             */
            node.getContact = async (contactId) => {
                contactId = contactId.toLowerCase();
                const header = JSON.stringify({
                    from: this.node.identity.toString('hex').toLowerCase(),
                    to: contactId,
                    ttl: kadence.constants.MAX_RELAY_HOPS,
                });

                return new Promise((accept, reject) => {
                    // find contact in routing table
                    const contact = node.router.getContactByNodeId(contactId);
                    if (contact && contact.hostname && contactId === contact.identity) {
                        this.log.debug(`Found contact in routing table. ${contactId} - ${contact.hostname}:${contact.port}`);
                        accept({ contact: [contactId, contact], header });
                    }

                    // iterative find node
                    this.node.iterativeFindNode(contactId, (err, result) => {
                        if (err) {
                            reject(Error(`Failed to find contact ${contactId}. ${err}`));
                        }
                        if (result && Array.isArray(result)) {
                            const contact = result[0];
                            if (contact && Array.isArray(contact) && contact.length === 2
                                && contact[1].hostname && contact[0] === contact[1].identity) {
                                this.log.debug(`Found contact in routing table. ${contact[0]} - ${contact[1].hostname}:${contact[1].port}`);
                                accept({ contact, header });
                            }
                            reject(Error(`Unknown contact ${contactId}.`));
                        }
                        reject(Error(`Failed to find contact ${contactId}. Not array: ${result}`));
                    });
                });
            };

            node.replicationRequest = async (message, contactId) => {
                const { contact, header } = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send('kad-replication-request', { message, header }, contact, (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };

            node.replacementReplicationRequest = async (message, contactId) => {
                const { contact, header } = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send('kad-replacement-replication-request', { message, header }, contact, (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };

            node.replicationFinished = async (message, contactId) => {
                const { contact, header } = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send('kad-replication-finished', { message, header }, contact, (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };

            node.replacementReplicationFinished = async (message, contactId) => {
                const { contact, header } = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send('kad-replacement-replication-finished', { message, header }, contact, (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };

            node.challengeRequest = async (message, contactId) => {
                const { contact, header } = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send('kad-challenge-request', { message, header }, contact, (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };

            node.challengeResponse = async (message, contactId) => {
                const { contact, header } = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send('kad-challenge-response', { message, header }, contact, (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };

            node.sendDataLocationResponse = async (message, contactId) => {
                const { contact, header } = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send('kad-data-location-response', { message, header }, contact, (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };

            node.dataReadRequest = async (message, contactId) => {
                const { contact, header } = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send('kad-data-read-request', { message, header }, contact, (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };

            node.sendDataReadResponse = async (message, contactId) => {
                const { contact, header } = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send('kad-data-read-response', { message, header }, contact, (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };

            node.sendEncryptedKey = async (message, contactId) => {
                const { contact, header } = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send('kad-send-encrypted-key', { message, header }, contact, (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };

            node.sendEncryptedKeyProcessResult = async (message, contactId) => {
                const { contact, header } = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send('kad-encrypted-key-process-result', { message, header }, contact, (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };

            node.publish = async (topic, message, opts = {}) => new Promise((resolve, reject) => {
                node.quasar.quasarPublish(
                    topic, message, opts,
                    (err, successfulPublishes) => {
                        if (err) {
                            reject(err);
                        } else {
                            if (successfulPublishes === 0) {
                                // Publish failed.
                                reject(Error('Publish failed.'));
                                return;
                            }
                            this.log.debug(`Published successfully to ${successfulPublishes} peers.`);
                            resolve(successfulPublishes);
                        }
                    },
                );
            });
        });
    }

    /**
     * Sends response
     * @param response
     * @param data
     * @returns {Promise<void>}
     */
    sendResponse(response, data) {
        return new Promise((resolve, reject) => {
            try {
                response.send(data);
                resolve();
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Extracts message from native request
     * @param request
     * @returns {*}
     */
    extractMessage(request) {
        return request.params.message;
    }

    /**
     * Extracts status from native request
     * @param request
     * @returns {*}
     */
    extractRequestStatus(request) {
        return request.params.status;
    }

    /**
     * Extracts status from native response
     * @param request
     * @returns {*}
     */
    extractResponseStatus(response) {
        return response.status;
    }

    /**
     * Extracts sender identity from native request
     * @param request
     * @returns {*}
     */
    extractSenderID(request) {
        return request.contact[0];
    }

    /**
     * Extracts sender information from native request
     * @param request
     * @returns {*}
     */
    extractSenderInfo(request) {
        return request.contact[1];
    }

    /**
     * Validates contact.
     *
     * Checks if contact is in the network by checking network ID and if contact has IP
     * check if it's in the local or remote network based on current configuration.
     * @param contact Contact to check
     * @returns {boolean} true if contact is in the same network.
     */
    validateContact(identity, contact) {
        if (ip.isV4Format(contact.hostname) || ip.isV6Format(contact.hostname)) {
            if (this.config.local_network_only && ip.isPublic(contact.hostname)) {
                return false;
            } else if (!this.config.local_network_only && ip.isPrivate(contact.hostname)) {
                return false;
            }
        }
        if (!contact.network_id || contact.network_id !== this.config.network.id) {
            return false;
        }

        if (this.config.requireApproval && !this.approvalService.isApproved(identity)) {
            return false;
        }
        return true;
    }

    /**
     * Returns basic network information
     */
    async getNetworkInfo() {
        return {
            identity: this.node.identity.toString('hex'),
            contact: this.node.contact,
        };
    }

    /**
     * Dumps all peers from buckets
     */
    dumpContacts() {
        const message = {};
        this.node.router.forEach((value, key, map) => {
            if (value.length > 0) {
                value.forEach((bValue, bKey, bMap) => {
                    message[bKey] = bValue;
                });
            }
        });
        return message;
    }

    dumpSummary() {
        const message = {};
        this.node.router.forEach((value, key, map) => {
            if (value.length > 0) {
                message[key] = value.length;
            }
        });
        return message;
    }

    async findNode(contactId) {
        let contact;
        try {
            {contact, header } = await this.node.getContact(contactId);
        } catch (e) {

        }
        return contact;
        // return new Promise((accept, reject) => {
        //     this.node.iterativeFindNode(contactId, (error, result) => {
        //         if (error) {
        //             reject(error);
        //             return;
        //         }
        //
        //         accept({
        //             contact: this.node.router.getContactByNodeId(contactId),
        //             neighbors: result,
        //         });
        //         accept(result);
        //     });
        // });
    }

    async pingNode(contactId) {
        return new Promise(async (resolve, reject) => {
            const message = {};
            const { contact, header } = await this.node.getContact(contactId);
            // const message = JSON.stringify({
            //     from: this.node.identity.toString('hex').toLowerCase(),
            //     to: contactId,
            //     ttl: 6,
            // });
            // console.log(JSON.stringify(contact[0]));
            // console.log(JSON.stringify(contact[1]));

            if ((contact[0]).toLowerCase() !== this.node.identity.toString('hex').toLowerCase() && contact[0] === contact[1].identity) {
                this.node.send('kad-ping-request', { message: {}, header }, contact, (err, res) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(res);
                    }
                });
            } else {
                resolve();
            }
        });
    }

    _saveIdentityToFile(privateKey, nonce = null, proof = null) {
        const identityFilePath = path.join(
            this.config.appDataPath,
            this.config.identity_filepath,
        );
        fs.writeFileSync(identityFilePath, JSON.stringify({
            privateKey,
            nonce,
            proof,
        }));
    }
}

module.exports = Kademlia;
