process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const async = require('async');
const levelup = require('levelup');
const encoding = require('encoding-down');
const kadence = require('@kadenceproject/kadence');
const config = require('../../Config');
const fs = require('fs');
const utilities = require('../../Utilities');
const _ = require('lodash');
const sleep = require('sleep-async')().Promise;
const leveldown = require('leveldown');
const PeerCache = require('./peer-cache');
const ip = require('ip');
const KadenceUtils = require('@kadenceproject/kadence/lib/utils.js');
const { IncomingMessage, OutgoingMessage } = require('./logger');

const pjson = require('../../../package.json');

const { NetworkRequestIgnoredError } = require('../../errors/index');

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

        kadence.constants.T_RESPONSETIMEOUT = parseInt(config.request_timeout, 10);
        if (parseInt(config.test_network, 10)) {
            this.log.warn('Node is running in test mode, difficulties are reduced');
            process.env.kadence_TestNetworkEnabled = config.test_network;
            kadence.constants.SOLUTION_DIFFICULTY = kadence.constants.TESTNET_DIFFICULTY;
            kadence.constants.IDENTITY_DIFFICULTY = kadence.constants.TESTNET_DIFFICULTY;
        }
        this.index = parseInt(config.child_derivation_index, 10);

        // Initialize private extended key
        utilities.createPrivateExtendedKey(kadence);
    }

    async bootstrapFindContact(contactId) {
        const bootstrapNodes = config.network_bootstrap_nodes;

        for (let i = 0; i < bootstrapNodes.length; i += 1) {
            const node = bootstrapNodes[i];
            const bootstrapContact = kadence.utils.parseContactURL(node);

            // eslint-disable-next-line no-await-in-loop
            const response = await this.node.findContact(contactId, bootstrapContact[0]);

            if (response) {
                console.log('GOT FUCKIN ANSWER', JSON.stringify(response));
                return;
            }
        }

        return null;
    }


    /**
     * Initializes keys
     * @return {Promise<void>}
     */
    async initialize() {
        // Check config
        this.kademliaUtilities.verifyConfiguration(config);

        this.log.info('Checking SSL certificate');
        await this.kademliaUtilities.setSelfSignedCertificate(config);

        this.log.info('Getting the identity');
        this.xprivkey = fs.readFileSync(`${__dirname}/../../../keys/${config.private_extended_key_path}`).toString();
        this.identity = new kadence.eclipse.EclipseIdentity(
            this.xprivkey,
            this.index,
            kadence.constants.HD_KEY_DERIVATION_PATH,
        );

        this.log.info('Checking the identity');
        // Check if identity is valid
        this.kademliaUtilities.checkIdentity(this.identity);

        const { childKey } = this.kademliaUtilities.getIdentityKeys(
            this.xprivkey,
            kadence.constants.HD_KEY_DERIVATION_PATH,
            parseInt(config.child_derivation_index, 10),
        );
        this.identity = kadence.utils.toPublicKeyHash(childKey.publicKey).toString('hex');

        this.log.notify(`My identity: ${this.identity}`);
        config.identity = this.identity;
    }

    /**
     * Starts the node
     * @return {Promise<void>}
     */
    start() {
        return new Promise(async (resolve) => {
            this.log.info('Initializing network');

            const { parentKey } = this.kademliaUtilities.getIdentityKeys(
                this.xprivkey,
                kadence.constants.HD_KEY_DERIVATION_PATH,
                parseInt(config.child_derivation_index, 10),
            );

            const onionEnabled = parseInt(config.onion_enabled, 10);
            const natTraversalEnabled = parseInt(config.traverse_nat_enabled, 10);

            let kadServerHost = null;
            if (config.local_network_only || natTraversalEnabled || onionEnabled) {
                kadServerHost = '127.0.0.1';
            } else {
                kadServerHost = await utilities.getExternalIp();
            }

            // Initialize public contact data
            const contact = {
                hostname: kadServerHost,
                protocol: 'https:',
                port: parseInt(config.node_port, 10),
                xpub: parentKey.publicExtendedKey,
                index: parseInt(config.child_derivation_index, 10),
                agent: kadence.version.protocol,
                wallet: config.node_wallet,
                network_id: config.network_id,
            };

            const key = fs.readFileSync(`${__dirname}/../../../keys/${config.ssl_keypath}`);
            const cert = fs.readFileSync(`${__dirname}/../../../keys/${config.ssl_certificate_path}`);
            const ca = config.ssl_authority_paths.map(fs.readFileSync);

            // Initialize transport adapter
            const transport = new kadence.HTTPSTransport({ key, cert, ca });

            // Initialize protocol implementation
            this.node = new kadence.KademliaNode({
                logger: this.log,
                transport,
                identity: Buffer.from(this.identity, 'hex'),
                contact,
                storage: levelup(encoding(leveldown(`${__dirname}/../../../data/kadence.dht`))),
            });

            const { validateContact } = this;

            // Override node's _updateContact method to filter contacts.
            this.node._updateContact = (identity, contact) => {
                try {
                    if (!validateContact(contact)) {
                        this.log.debug(`Ignored contact ${identity}. Hostname ${contact.hostname}. Network ID ${contact.network_id}.`);
                        return;
                    }
                } catch (err) {
                    this.log.debug(`Failed to filter contact(${identity}, ${contact}). ${err}.`);
                    return;
                }

                // Simulate node's "super._updateContact(identity, contact)".
                this.node.constructor.prototype.constructor.prototype
                    ._updateContact.call(this.node, identity, contact);
            };

            this.node.use((request, response, next) => {
                if (!validateContact(request.contact[1])) {
                    return next(new NetworkRequestIgnoredError('Contact not valid.', request));
                }
                next();
            });

            this.log.info('Starting OT Node...');
            this.node.eclipse = this.node.plugin(kadence.eclipse());
            this.node.quasar = this.node.plugin(kadence.quasar());
            this.log.info('Quasar initialised');
            this.node.peercache = this.node.plugin(PeerCache(`${__dirname}/../../../data/${config.embedded_peercache_path}`));
            this.log.info('Peercache initialised');

            if (onionEnabled) {
                this.enableOnion();
            }

            if (natTraversalEnabled) {
                this.enableNatTraversal();
            }

            // Use verbose logging if enabled
            if (process.env.LOGS_LEVEL_DEBUG) {
                this.node.rpc.deserializer.append(new IncomingMessage(this.log));
                this.node.rpc.serializer.prepend(new OutgoingMessage(this.log));
            }
            // Cast network nodes to an array
            if (typeof config.network_bootstrap_nodes === 'string') {
                config.network_bootstrap_nodes = config.network_bootstrap_nodes.trim().split();
            }

            this._registerRoutes();

            this.node.listen(parseInt(config.node_port, 10), async () => {
                this.log.notify(`OT Node listening at https://${this.node.contact.hostname}:${this.node.contact.port}`);
                this.kademliaUtilities.registerControlInterface(config, this.node);

                const connected = false;
                const retryPeriodSeconds = 5;
                while (!connected) {
                    try {
                        // eslint-disable-next-line
                        const connected = await this._joinNetwork(contact);
                        if (connected) {
                            resolve();
                            break;
                        }
                    } catch (e) {
                        this.log.error(`Failed to join network ${e}`);
                        this.notifyError(e);
                    }

                    this.log.error(`Failed to join network, will retry in ${retryPeriodSeconds} seconds. Bootstrap nodes are probably not online.`);
                    // eslint-disable-next-line
                    await sleep.sleep(retryPeriodSeconds * 1000);
                }
            });
        });
    }

    enableNatTraversal() {
        this.log.info('Trying NAT traversal');

        const remoteAddress = config.reverse_tunnel_address;
        const remotePort = parseInt(config.reverse_tunnel_port, 10);

        this.node.traverse = this.node.plugin(kadence.traverse([
            new kadence.traverse.ReverseTunnelStrategy({
                remotePort,
                remoteAddress,
                secureLocalConnection: true,
                verboseLogging: false,
            }),
        ]));
    }

    /**
     * Enables Onion client
     */
    enableOnion() {
        this.log.info('Use Tor for an anonymous overlay');
        this.node.onion = this.node.plugin(kadence.onion({
            dataDirectory: `${__dirname}/../../../data/hidden_service`,
            virtualPort: config.onion_virtual_port,
            localMapping: `127.0.0.1:${config.node_port}`,
            torrcEntries: {
                LearnCircuitBuildTimeout: 0,
                CircuitBuildTimeout: 40,
                CircuitStreamTimeout: 30,
                MaxCircuitDirtiness: 7200,
                MaxClientCircuitsPending: 1024,
                SocksTimeout: 41,
                CloseHSClientCircuitsImmediatelyOnTimeout: 1,
                CloseHSServiceRendCircuitsImmediatelyOnTimeout: 1,
                SafeLogging: 0,
                FetchDirInfoEarly: 1,
                FetchDirInfoExtraEarly: 1,
            },
            passthroughLoggingEnabled: 1,
        }));
        this.log.info('Onion initialised');
    }

    /**
     * Try to join network
     * Note: this method tries to find possible bootstrap nodes
     */
    async _joinNetwork() {
        return new Promise(async (accept, reject) => {
            const bootstrapNodes = config.network_bootstrap_nodes;
            utilities.shuffle(bootstrapNodes);

            if (utilities.isBootstrapNode()) {
                this.log.info(`Found ${bootstrapNodes.length} provided bootstrap node(s). Running as a Bootstrap node`);
            } else {
                this.log.info(`Found ${bootstrapNodes.length} provided bootstrap node(s)`);
            }

            this.log.info(`Sync with network from ${bootstrapNodes.length} unique peers`);
            if (bootstrapNodes.length === 0) {
                this.log.info('No bootstrap seeds provided and no known profiles');
                this.log.info('Running in seed mode (waiting for connections)');
                accept(true);
                return;
            }

            let connected = false;
            const promises = bootstrapNodes.map((node) => {
                return new Promise((acc, rej) => {
                    const contact = kadence.utils.parseContactURL(node);
                    this.log.debug(`Joining ${contact[0]}`);
                    this.node.join(contact, (err) => {
                        if (err) {
                            this.log.warn(`Failed to join ${contact[0]}`);
                            acc(false);
                            return;
                        }
                        this.log.info(`Connected to ${contact[0]}(${contact[1].hostname}:${contact[1].port})`);
                        connected = true;
                        acc(true);
                    });
                });
            });
            await Promise.all(promises);
            accept(connected);
        });
    }

    /**
     * Register Kademlia routes and error handlers
     */
    _registerRoutes() {
        if (utilities.isBootstrapNode()) {
            // async
            this.node.use('kad-find-contact', (request, response, next) => {
                this.log.debug('kad-find-contact received');

                try {
                    const contactId = request.params.message.contact;

                    let contact = this.node.router.getContactByNodeId(contactId);
                    if (contact && contact.hostname) {
                        response.send({ contact });
                        return;
                    }

                    this.node.peercache.getExternalPeerInfo(contactId).then((peerContact) => {
                        if (peerContact) {
                            contact = KadenceUtils.parseContactURL(peerContact);

                            if (contact.length === 2 && contact[1].hostname) {
                                response.send({ contact: contact[1] });
                            }
                        }
                    }).catch(error => response.error(error));
                } catch (error) {
                    response.error(error);
                }
            });

            // error handler
            this.node.use('kad-find-contact', (err, request, response, next) => {
                this.log.warn(`kad-find-contact error received. ${err}`);
                response.error(err);
            });

            return;
        }

        this.node.quasar.quasarSubscribe('kad-data-location-request', (message, err) => {
            this.log.info('New location request received');
            this.emitter.emit('kad-data-location-request', message);
        });

        // async
        this.node.use('kad-payload-request', (request, response, next) => {
            this.log.debug('kad-payload-request received');
            this.emitter.emit('kad-payload-request', request);
            response.send([]);
        });

        // async
        this.node.use('kad-replication-request', (request, response, next) => {
            this.log.debug('kad-replication-request received');
            this.emitter.emit('kad-replication-request', request);
            response.send([]);
        });

        // async
        this.node.use('kad-replication-finished', (request, response, next) => {
            this.log.debug('kad-replication-finished received');
            this.emitter.emit('kad-replication-finished', request);
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
        this.node.use('kad-verify-import-request', (request, response, next) => {
            this.log.debug('kad-verify-import-request received');
            this.emitter.emit('kad-verify-import-request', request);
            response.send([]);
        });

        // async
        this.node.use('kad-verify-import-response', (request, response, next) => {
            this.log.debug('kad-verify-import-response received');
            this.emitter.emit('kad-verify-import-response', request);
            response.send([]);
        });

        // sync
        this.node.use('kad-challenge-request', (request, response, next) => {
            this.log.debug('kad-challenge-request received');
            this.emitter.emit('kad-challenge-request', request, response);
        });

        // error handler
        this.node.use('kad-challenge-request', (err, request, response, next) => {
            response.send({
                error: 'kad-challenge-request error',
            });
        });

        // error handler
        this.node.use('kad-payload-request', (err, request, response, next) => {
            this.log.warn(`kad-payload-request error received. ${err}`);
            response.error(err);
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
             * Gets contact by ID
             * @param contactId Contact ID
             * @returns {{"{": Object}|Array}
             */
            node.getContact = async (contactId) => {
                let contact = node.router.getContactByNodeId(contactId);
                if (contact && contact.hostname) {
                    this.log.debug(`Found contact in routing table. ${contactId} - ${contact.hostname}:${contact.port}`);
                    return contact;
                }
                const peerContact = await this.node.peercache.getExternalPeerInfo(contactId);
                if (peerContact) {
                    const peerContactArray = KadenceUtils.parseContactURL(peerContact);

                    if (peerContactArray.length === 2 && peerContactArray[1].hostname) {
                        [, contact] = peerContactArray;

                        this.log.debug(`Found contact in peer cache. ${contactId} - ${contact.hostname}:${contact.port}.`);
                        return new Promise((accept, reject) => {
                            this.node.ping(contact, (error) => {
                                if (error) {
                                    this.log.debug(`Contact ${contactId} not reachable: ${error}.`);
                                    accept(null);
                                    return;
                                }
                                accept(contact);
                            });
                        }).then((contact) => {
                            if (contact) {
                                return contact;
                            }
                            return new Promise(async (accept, reject) => {
                                this.log.debug(`Asking bootstrap for contact: ${contactId}.`);

                                const freshContact =
                                    await this.bootstrapFindContact(contactId);
                                this.log.debug(`Got contact for: ${contactId}. ${freshContact.hostname}:${freshContact.port}.`);
                                accept(freshContact);
                            });
                        });
                    }
                }

                this.log.debug(`No knowledge about contact ${contactId}. Asking bootstrap for it.`);
                return new Promise(async (accept, reject) => {
                    const freshContact =
                        await this.bootstrapFindContact(contactId);
                    if (freshContact) {
                        this.log.debug(`Bootstrap find done for: ${contactId}. ${freshContact.hostname}:${freshContact.port}.`);
                    } else {
                        this.log.debug(`Bootstrap find failed for: ${contactId}.`);
                    }
                    accept(freshContact);
                });
            };

            /**
             * Tries to refresh buckets based on contact ID
             * @param contactId
             * @param retry
             * @return {Promise}
             */
            node.refreshContact = async (contactId, retry) => new Promise(async (resolve) => {
                const _refresh = () => new Promise((resolve, reject) => {
                    this.node.iterativeFindNode(contactId, (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            const contact = this.node.router.getContactByNodeId(contactId);
                            if (contact && contact.hostname) {
                                resolve(contact);
                            } else {
                                resolve(null);
                            }
                        }
                    });
                });

                try {
                    if (retry) {
                        for (let i = 1; i <= 3; i += 1) {
                            // eslint-disable-next-line no-await-in-loop
                            const contact = await _refresh();
                            if (contact) {
                                resolve(contact);
                                return;
                            }
                            // eslint-disable-next-line
                            await sleep.sleep((2 ** i) * 1000);
                        }
                    } else {
                        await _refresh(contactId, retry);
                    }

                    resolve(null);
                } catch (e) {
                    // failed to refresh buckets (should not happen)
                    this.notifyError(e);
                }
            });

            node.findContact = async (contactToFind, contactId) => {
                const contact = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send(
                        'kad-find-contact',
                        {
                            message: { contact: contactToFind },
                        },
                        [contactId, contact],
                        (err, res) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(res);
                            }
                        },
                    );
                });
            };

            node.payloadRequest = async (message, contactId) => {
                const contact = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send('kad-payload-request', { message }, [contactId, contact], (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };

            node.replicationRequest = async (message, contactId) => {
                const contact = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send('kad-replication-request', { message }, [contactId, contact], (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };

            node.replicationFinished = async (message, contactId) => {
                const contact = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send('kad-replication-finished', { message }, [contactId, contact], (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };

            node.challengeRequest = async (message, contactId) => {
                const contact = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send('kad-challenge-request', { message }, [contactId, contact], (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };

            node.sendDataLocationResponse = async (message, contactId) => {
                const contact = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send('kad-data-location-response', { message }, [contactId, contact], (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };

            node.dataReadRequest = async (message, contactId) => {
                const contact = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send('kad-data-read-request', { message }, [contactId, contact], (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };

            node.sendDataReadResponse = async (message, contactId) => {
                const contact = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send('kad-data-read-response', { message }, [contactId, contact], (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };

            node.sendEncryptedKey = async (message, contactId) => {
                const contact = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send('kad-send-encrypted-key', { message }, [contactId, contact], (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };

            node.sendEncryptedKeyProcessResult = async (message, contactId) => {
                const contact = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send('kad-encrypted-key-process-result', { message }, [contactId, contact], (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };

            node.verifyImport = async (message, contactId) => {
                const contact = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send('kad-verify-import-request', { message }, [contactId, contact], (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
                        }
                    });
                });
            };

            node.sendVerifyImportResponse = async (message, contactId) => {
                const contact = await node.getContact(contactId);
                return new Promise((resolve, reject) => {
                    node.send('kad-verify-import-response', { message }, [contactId, contact], (err, res) => {
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
                    (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(res);
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
    validateContact(contact) {
        if (ip.isV4Format(contact.hostname) || ip.isV6Format(contact.hostname)) {
            if (config.local_network_only && ip.isPublic(contact.hostname)) {
                return false;
            } else if (!config.local_network_only && ip.isPrivate(contact.hostname)) {
                return false;
            }
        }
        if (!contact.network_id || contact.network_id !== config.network_id) {
            return false;
        }

        return true;
    }

    /**
     * Returns basic network information
     */
    async getNetworkInfo() {
        const peers = [];
        const dump = this.node.router.getClosestContactsToKey(
            this.node.identity,
            kadence.constants.K * kadence.constants.B,
        );

        for (const peer of dump) {
            peers.push(peer);
        }

        return {
            versions: pjson.version,
            identity: this.node.identity.toString('hex'),
            contact: this.node.contact,
            peers,
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
}

module.exports = Kademlia;
