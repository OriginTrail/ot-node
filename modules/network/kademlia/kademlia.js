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
const ECEncryption = require('../../ECEncryption');
const NetworkService = require('../../service/network-service');

const KadenceUtils = require('@deadcanaries/kadence/lib/utils.js');
const { IncomingMessage, OutgoingMessage } = require('./logger');

const pjson = require('../../../package.json');

const { NetworkRequestIgnoredError } = require('../../errors/index');

const directMessageRequests = [
    { methodName: 'replicationRequest', routeName: 'kad-replication-request' },
    { methodName: 'replacementReplicationRequest', routeName: 'kad-replacement-replication-request' },
    { methodName: 'replicationFinished', routeName: 'kad-replication-finished' },
    { methodName: 'replacementReplicationFinished', routeName: 'kad-replacement-replication-finished' },
    { methodName: 'challengeRequest', routeName: 'kad-challenge-request' },
    { methodName: 'challengeResponse', routeName: 'kad-challenge-response' },
    { methodName: 'sendDataLocationResponse', routeName: 'kad-data-location-response' },
    { methodName: 'dataReadRequest', routeName: 'kad-data-read-request' },
    { methodName: 'sendDataReadResponse', routeName: 'kad-data-read-response' },
    { methodName: 'sendPermissionedDataReadRequest', routeName: 'kad-permissioned-data-read-request' },
    { methodName: 'sendPermissionedDataReadResponse', routeName: 'kad-permissioned-data-read-response' },
    { methodName: 'sendDataPurchaseRequest', routeName: 'kad-data-purchase-request' },
    { methodName: 'sendDataPurchaseResponse', routeName: 'kad-data-purchase-response' },
    { methodName: 'sendPermissionedDataPriceRequest', routeName: 'kad-data-price-request' },
    { methodName: 'sendPermissionedDataPriceResponse', routeName: 'kad-data-price-response' },
    { methodName: 'sendEncryptedKey', routeName: 'kad-send-encrypted-key' },
    { methodName: 'sendEncryptedKeyProcessResult', routeName: 'kad-encrypted-key-process-result' },
];

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
        this.config = ctx.config;
        this.approvalService = ctx.approvalService;
        this.networkService = ctx.networkService;

        kadence.constants.T_RESPONSETIMEOUT = this.config.request_timeout;
        kadence.constants.SOLUTION_DIFFICULTY = this.config.network.solutionDifficulty;
        kadence.constants.IDENTITY_DIFFICULTY = this.config.network.identityDifficulty;
        kadence.constants.K = this.config.network.bucket_size;
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
        this.config.publicKeyData = {
            publicKey: publicKey.toString('hex'),
            nonce: this.nonce,
            proof: this.identity.proof.toString('hex'),
        };

        this.config.identity = this.identity.fingerprint.toString('hex').toLowerCase();

        this.log.notify(`My network identity: ${this.config.identity}`);
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
                    'kad-data-read-response', 'kad-data-purchase-request', 'kad-data-purchase-response',
                    'kad-data-price-request', 'kad-data-price-response',
                    'kad-permissioned-data-read-response', 'kad-permissioned-data-read-request',
                    'kad-send-encrypted-key', 'kad-encrypted-key-process-result',
                    'kad-replication-request', 'kad-replacement-replication-request', 'kad-replacement-replication-finished',
                    'kad-public-key-request',
                ],
                difficulty: this.config.network.solutionDifficulty,
            }));
            this.log.info('Hashcash initialised');

            this.node.quasar = this.node.plugin(kadence.quasar());

            this.log.info('Quasar initialised');

            const nodeIdentity = this.node.identity;

            const spartacusPlugin = kadence.spartacus(
                this.privateKey,
                { checkPublicKeyHash: false },
            );
            this.node.spartacus = this.node.plugin(spartacusPlugin);

            this.node.identity = nodeIdentity;
            this.node.router.identity = nodeIdentity;
            this.node.spartacus.identity = nodeIdentity;

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
                        process.exit(1);
                    }

                    if (entry) {
                        this.log.info(`Connected to network via ${entry}`);
                        this.log.info(`Discovered ${this.node.router.size} peers from seed`);
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
            this.log.info('No bootstrap seeds provided and no known profiles');
            this.log.info('Running in seed mode (waiting for connections)');

            this.node.router.events.once('add', (identity) => {
                this.config.network.bootstraps = [
                    kadence.utils.getContactURL([
                        identity,
                        this.node.router.getContactByNodeId(identity),
                    ]),
                ];
                this.joinNetwork(callback);
            });

            callback(null, null);
        } else {
            this.log.info(`Joining network from ${peers.length} seeds`);
            async.detectSeries(peers, (url, done) => {
                const contact = kadence.utils.parseContactURL(url);
                this.node.join(contact, (err) => {
                    done(null, (!err) && this.node.router.size > 0);
                });
            }, (err, result) => {
                if (!result) {
                    this.log.error('Failed to join network, will retry in 1 minute');
                    callback(new Error('Failed to join network'));
                } else {
                    callback(null, result);
                }
            });
        }
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
        this.node.plugin((node) => {
            node.packMessage = async (contactId, message) => {
                // eslint-disable-next-line prefer-const
                let { contact, header } = await node.getContact(contactId);
                let body = message;
                if (contact[0] !== contactId) {
                    let publicKey = await this.networkService.getNodePublicKey(contactId);
                    if (!publicKey) {
                        try {
                            const publicKeyData = await node.sendPublicKeyRequest(
                                null,
                                contactId,
                            );

                            if (await this.networkService.validatePublicKeyData(publicKeyData)) {
                                await this.networkService.setNodePublicKey(publicKeyData);
                            } else {
                                throw new Error('Public key validation error');
                            }
                            publicKey = Buffer.from(publicKeyData.public_key, 'hex')
                                .toString('hex');
                        } catch (e) {
                            throw Error('Unable to get node public key for encryption');
                        }
                    }
                    body = await ECEncryption.encryptObject(message, publicKey);
                    const messageHeader = JSON.parse(header);
                    messageHeader.encrypted = true;
                    header = JSON.stringify(messageHeader);
                }

                return { contact, header, body };
            };

            node.unpackMessage = async (request) => {
                const header = JSON.parse(request.params.header);
                if (header.encrypted) {
                    const message =
                        await ECEncryption.decrypt(request.params.message, this.privateKey.toString('hex'));
                    request.params.message = JSON.parse(message);
                }
            };
            /**
             * Get contact by Node ID
             * @param contactId
             * @returns Promise{ contact: [contactId, contact], header }
             */
            node.getContact = async (contactId) => {
                contactId = contactId.toLowerCase();
                const header = JSON.stringify({
                    from: this.config.identity,
                    to: contactId,
                    ttl: kadence.constants.MAX_RELAY_HOPS,
                    encrypted: false,
                });

                return new Promise((accept, reject) => {
                    // find contact in routing table
                    const contact = node.router.getContactByNodeId(contactId);
                    if (contact && contactId === contact.identity &&
                        contact.hostname && contact.port) {
                        this.log.debug(`Found contact in routing table. ${contactId} - ${contact.hostname}:${contact.port}`);
                        accept({ contact: [contactId, contact], header });
                    }

                    // iterative find node
                    this.node.iterativeFindNode(contactId, (err, result) => {
                        if (err) {
                            reject(Error(`Failed to find contact ${contactId}. ${err}`));
                        }
                        const contact = this._getContactFromInterativeFindNodeResult(result);
                        if (contact && Array.isArray(contact) && contact.length === 2
                                && contact[1].hostname && contact[1].port
                                && contact[0] === contact[1].identity) {
                            this.log.debug(`Found proxy contact in routing table. ${contact[0]} - ${contact[1].hostname}:${contact[1].port}`);
                            accept({ contact, header });
                        }
                        reject(Error(`Unknown contact ${contactId}.`));
                    });
                });
            };
        });

        this.node.use('*', async (request, response, next) => {
            if (request.params.header) {
                const header = JSON.parse(request.params.header);
                if (header.ttl && header.from && header.to) {
                    const srcContact = header.from;
                    const destContact = header.to;
                    header.ttl -= 1;
                    if (header.ttl >= 0) {
                        if (destContact === this.config.identity) {
                            await this.node.unpackMessage(request);
                            response.send(next());
                        } else {
                            const result = await new Promise(async (accept, reject) => {
                                const { contact } = await this.node.getContact(destContact);
                                this.log.debug(`Request received from ${srcContact} for ${destContact}. Forwarding to: ${contact[0]}`);
                                // should await?
                                this.node.send(
                                    request.method,
                                    {
                                        message: request.params.message,
                                        header: request.params.header,
                                    },
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
                            response.send(result);
                        }
                    } else response.send('Message includes invalid TTL.');
                } else response.send('Message includes invalid header.');
            } else next();
        });

        if (this.config.is_bootstrap_node) {
            return;
        }

        this.node.quasar.quasarSubscribe('kad-data-location-request', (message, err) => {
            this.log.info('New location request received');
            this.emitter.emit('kad-data-location-request', message);
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
        this.node.use('kad-permissioned-data-read-request', (request, response, next) => {
            this.log.debug('kad-permissioned-data-read-request received');
            this.emitter.emit('kad-permissioned-data-read-request', request);
            response.send([]);
        });

        // async
        this.node.use('kad-permissioned-data-read-response', (request, response, next) => {
            this.log.debug('kad-permissioned-data-read-response received');
            this.emitter.emit('kad-permissioned-data-read-response', request);
            response.send([]);
        });

        // async
        this.node.use('kad-data-purchase-request', (request, response, next) => {
            this.log.debug('kad-data-purchase-request received');
            this.emitter.emit('kad-data-purchase-request', request);
            response.send([]);
        });

        // async
        this.node.use('kad-data-purchase-response', (request, response, next) => {
            this.log.debug('kad-data-purchase-response received');
            this.emitter.emit('kad-data-purchase-response', request);
            response.send([]);
        });

        // async
        this.node.use('kad-data-price-request', (request, response, next) => {
            this.log.debug('kad-data-price-request received');
            this.emitter.emit('kad-data-price-request', request);
            response.send([]);
        });

        // async
        this.node.use('kad-data-price-response', (request, response, next) => {
            this.log.debug('kad-data-price-response received');
            this.emitter.emit('kad-data-price-response', request);
            response.send([]);
        });

        // async
        this.node.use('kad-data-purchase-request', (request, response, next) => {
            this.log.debug('kad-data-purchase-request received');
            this.emitter.emit('kad-data-purchase-request', request);
            response.send([]);
        });

        // async
        this.node.use('kad-data-purchase-response', (request, response, next) => {
            this.log.debug('kad-data-purchase-response received');
            this.emitter.emit('kad-data-purchase-response', request);
            response.send([]);
        });

        // async
        this.node.use('kad-data-price-request', (request, response, next) => {
            this.log.debug('kad-data-price-request received');
            this.emitter.emit('kad-data-price-request', request);
            response.send([]);
        });

        // async
        this.node.use('kad-data-price-response', (request, response, next) => {
            this.log.debug('kad-data-price-response received');
            this.emitter.emit('kad-data-price-response', request);
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
        this.node.use('kad-public-key-request', (request, response, next) => {
            this.log.debug('kad-public-key-request received');
            this.emitter.emit('kad-public-key-request', request, response);
            response.send([]);
        });

        // async
        this.node.use('kad-challenge-request', (request, response, next) => {
            this.log.debug('kad-challenge-request received');
            this.emitter.emit('kad-challenge-request', request, response);
            response.send([]);
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
            node.sendDirectMessage = async (message, contactId, method) => {
                try {
                    const { contact, header, body } = await node.packMessage(contactId, message);
                    return new Promise((resolve, reject) => {
                        node.send(method, { message: body, header }, contact, (err, res) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(res);
                            }
                        });
                    });
                } catch (error) {
                    return new Promise((resolve, reject) => {
                        reject(error);
                    });
                }
            };

            node.sendUnpackedMessage = async (message, contactId, method) => {
                const { contact, header } = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send(method, { message, header }, contact, (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };

            /**
             * Helper method for getting nearest contact (used for testing purposes only)
             * @returns {*}
             */
            node.getNearestNeighbour = () =>
                [...node.router.getClosestContactsToKey(this.identity).entries()].shift();

            directMessageRequests.forEach((element) => {
                node[element.methodName] = async (message, contactId) =>
                    node.sendDirectMessage(message, contactId, element.routeName);
            });

            node.sendPublicKeyRequest = async (message, contactId) =>
                node.sendUnpackedMessage(message, contactId, 'kad-public-key-request');

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
        if (request.params.header) {
            const header = JSON.parse(request.params.header);
            return header.from.toLowerCase();
        }
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

    async findNode(contactId) {
        return new Promise((accept, reject) => {
            this.node.iterativeFindNode(contactId, (error, result) => {
                if (error) {
                    reject(error);
                    return;
                }

                accept({
                    contact: this.node.router.getContactByNodeId(contactId),
                    neighbors: result,
                });
                accept(result);
            });
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

    _getContactFromInterativeFindNodeResult(result) {
        for (const contact of result) {
            if (contact[0] !== this.config.identity) {
                return contact;
            }
        }
        return null;
    }
}

module.exports = Kademlia;
