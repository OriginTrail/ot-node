const Libp2p = require('libp2p');
const { Record } = require('libp2p-record');
const KadDHT = require('libp2p-kad-dht');
const Bootstrap = require('libp2p-bootstrap');
const { NOISE } = require('libp2p-noise');
const MPLEX = require('libp2p-mplex');
const TCP = require('libp2p-tcp');
const pipe = require('it-pipe');
const lp = require('it-length-prefixed');
const map = require('it-map');
const { sha256 } = require('multiformats/hashes/sha2');
const PeerId = require('peer-id');
const { InMemoryRateLimiter } = require('rolling-rate-limiter');
const toobusy = require('toobusy-js');
const { xor: uint8ArrayXor, compare: uint8ArrayCompare } = require('uint8arrays');
const constants = require('../../../constants/constants');

const initializationObject = {
    addresses: {
        listen: ['/ip4/0.0.0.0/tcp/9000'],
    },
    modules: {
        transport: [TCP],
        streamMuxer: [MPLEX],
        connEncryption: [NOISE],
        dht: KadDHT,
    },
    dialer: {
        dialTimeout: 2e3,
    },
    config: {
        dht: {
            enabled: true,
        },
    },
};

class Libp2pService {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;

        if (this.config.bootstrap.length > 0) {
            initializationObject.modules.peerDiscovery = [Bootstrap];
            initializationObject.config.peerDiscovery = {
                autoDial: true,
                [Bootstrap.tag]: {
                    enabled: true,
                    list: this.config.bootstrap,
                },
            };
        }
        initializationObject.addresses = {
            listen: [`/ip4/0.0.0.0/tcp/${this.config.port}`], // for production
            // announce: ['/dns4/auto-relay.libp2p.io/tcp/443/wss/p2p/QmWDn2LY8nannvSWJzruUYoLZ4vV83vfCBwd8DipvdgQc3']
        };
        let id;
        let privKey;
        if (!this.config.peerId) {
            if (!this.config.privateKey) {
                id = await PeerId.create({ bits: 1024, keyType: 'RSA' });
                privKey = id.toJSON().privKey;
            } else {
                privKey = this.config.privateKey;
                id = await PeerId.createFromPrivKey(this.config.privateKey);
            }
            this.config.privateKey = privKey;
            this.config.peerId = id;
        }

        initializationObject.peerId = this.config.peerId;
        this._initializeRateLimiters();
        /**
         * sessions = {
         *     [peerId]: {
         *         [handlerId]: {
         *             [keyword] : {
         *                  stream
         *              }
         *         }
         *     }
         * }
         */
        this.sessions = {};
        this.node = await Libp2p.create(initializationObject);
        this._initializeNodeListeners();
        await this.node.start();
        const port = parseInt(this.node.multiaddrs.toString().split('/')[4], 10);
        const peerId = this.node.peerId._idB58String;
        this.config.id = peerId;
        this.logger.info(`Network ID is ${peerId}, connection port is ${port}`);
    }

    _initializeNodeListeners() {
        this.node.on('peer:discovery', (peer) => {
            this._onPeerDiscovery(peer);
        });
        this.node.connectionManager.on('peer:connect', (connection) => {
            this._onPeerConnect(connection);
        });
    }

    _initializeRateLimiters() {
        const basicRateLimiter = new InMemoryRateLimiter({
            interval: constants.NETWORK_API_RATE_LIMIT.TIME_WINDOW_MILLS,
            maxInInterval: constants.NETWORK_API_RATE_LIMIT.MAX_NUMBER,
        });

        const spamDetection = new InMemoryRateLimiter({
            interval: constants.NETWORK_API_SPAM_DETECTION.TIME_WINDOW_MILLS,
            maxInInterval: constants.NETWORK_API_SPAM_DETECTION.MAX_NUMBER,
        });

        this.rateLimiter = {
            basicRateLimiter,
            spamDetection,
        };

        this.blackList = {};
    }

    _onPeerDiscovery(peer) {
        this.logger.trace(`Node ${this.node.peerId._idB58String} discovered ${peer._idB58String}`);
    }

    _onPeerConnect(connection) {
        this.logger.trace(
            `Node ${
                this.node.peerId._idB58String
            } connected to ${connection.remotePeer.toB58String()}`,
        );
    }

    async findNodes(key, protocol) {
        const encodedKey = new TextEncoder().encode(key);
        // Creates a DHT ID by hashing a given Uint8Array
        const id = (await sha256.digest(encodedKey)).digest;
        const nodes = this.node._dht.peerRouting.getClosestPeers(id);
        const result = new Set();
        for await (const node of nodes) {
            if (this.node.peerStore.peers.get(node._idB58String).protocols.includes(protocol)) {
                result.add(node);
            }
        }

        return [...result];
    }

    async rankNodes(nodes, key) {
        const encodedKey = new TextEncoder().encode(key);
        const keyMultiHash = await sha256.digest(encodedKey);
        const keyHash = keyMultiHash.digest;

        const calculateNodeDistance = async (node) => {
            const nodeBuffer = node.toBytes();
            const nodeMultiHash = await sha256.digest(nodeBuffer);
            const nodeHash = nodeMultiHash.digest;
            const distance = uint8ArrayXor(keyHash, nodeHash);

            return {
                node,
                distance,
            };
        };

        const nodeDistances = await Promise.all(nodes.map((node) => calculateNodeDistance(node)));

        nodeDistances.sort((a, b) => uint8ArrayCompare(a.distance, b.distance));

        return nodeDistances.map((nodeDistance) => nodeDistance.node);
    }

    getPeers() {
        return this.node.connectionManager.connections;
    }

    getPeerId() {
        return this.node.peerId;
    }

    store(peer, key, object) {
        const encodedKey = new TextEncoder().encode(key);
        const encodedObject = new TextEncoder().encode(object);
        const record = this._createPutRecord(encodedKey, encodedObject);
        return this.node._dht._putValueToPeer(encodedKey, record, peer);
    }

    _createPutRecord(key, value) {
        const rec = new Record(key, value, new Date());
        return rec.serialize();
    }

    async handleMessage(protocol, handler, options) {
        this.logger.info(`Enabling network protocol: ${protocol}`);

        this.node.handle(protocol, async (handlerProps) => {
            const { stream } = handlerProps;
            const remotePeerId = handlerProps.connection.remotePeer._idB58String;
            const { message, valid, busy } = await this._readMessageFromStream(
                stream,
                this.isRequestValid.bind(this),
                remotePeerId,
            );

            if (!valid) {
                await this.sendMessageResponse(
                    protocol,
                    remotePeerId,
                    constants.NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                    message.header.handlerId,
                    message.header.keyword,
                    {},
                );
            } else if (busy) {
                await this.sendMessageResponse(
                    protocol,
                    remotePeerId,
                    constants.NETWORK_MESSAGE_TYPES.RESPONSES.BUSY,
                    message.header.handlerId,
                    message.header.keyword,
                    {},
                );
            } else {
                this.logger.debug(
                    `Receiving message from ${remotePeerId} to ${this.config.id}: event=${protocol}, messageType=${message.header.messageType};`,
                );
                this.updateSessionStream(
                    message.header.handlerId,
                    message.header.keyword,
                    remotePeerId,
                    stream,
                );
                await handler(message, remotePeerId);
            }
        });
    }

    updateSessionStream(handlerId, keyword, remotePeerId, stream) {
        this.logger.trace(
            `Storing new session stream for remotePeerId: ${remotePeerId} with handler id: ${handlerId}, keyword: ${keyword}`,
        );
        if (!this.sessions[remotePeerId]) {
            this.sessions[remotePeerId] = {
                [handlerId]: {
                    [keyword]: {
                        stream,
                    },
                },
            };
        } else if (!this.sessions[remotePeerId][handlerId]) {
            this.sessions[remotePeerId][handlerId] = {
                [keyword]: {
                    stream,
                },
            };
        } else {
            this.sessions[remotePeerId][handlerId][keyword] = {
                stream,
            };
        }
    }

    getSessionStream(handlerId, keyword, remotePeerId) {
        if (
            this.sessions[remotePeerId] &&
            this.sessions[remotePeerId][handlerId] &&
            this.sessions[remotePeerId][handlerId][keyword]
        ) {
            this.logger.trace(
                `Session found remotePeerId: ${remotePeerId}, handler id: ${handlerId}, keyword: ${keyword}`,
            );
            return this.sessions[remotePeerId][handlerId][keyword].stream;
        }
        return null;
    }

    createStreamMessage(message, handlerId, keyword, messageType) {
        return {
            header: {
                messageType,
                handlerId,
                keyword,
            },
            data: message,
        };
    }

    async sendMessage(protocol, remotePeerId, messageType, handlerId, keyword, message) {
        this.logger.trace(
            `Sending message to ${remotePeerId._idB58String}: event=${protocol}, messageType=${messageType}, handlerId: ${handlerId}, keyword: ${keyword}`,
        );

        // const sessionStream = this.getSessionStream(handlerId, remotePeerId._idB58String);
        // if (!sessionStream) {
        this.logger.trace(
            `Dialing remotePeerId: ${remotePeerId._idB58String} for protocol: ${protocol}`,
        );
        const stream = (await this.node.dialProtocol(remotePeerId, protocol)).stream;
        // } else {
        //     stream = sessionStream;
        // }

        this.updateSessionStream(handlerId, keyword, remotePeerId._idB58String, stream);

        const streamMessage = this.createStreamMessage(message, handlerId, keyword, messageType);

        await this._sendMessageToStream(stream, streamMessage);
        // if (!this.sessions[remotePeerId._idB58String]) {
        //     this.sessions[remotePeerId._idB58String] = {
        //         [handlerId]: {
        //             stream
        //         }
        //     }
        // } else {
        //     this.sessions[remotePeerId._idB58String][handlerId] = {
        //             stream
        //     }
        // }
        // if (!this.sessions.sender[message.header.sessionId]) {
        //     this.sessions.sender[message.header.sessionId] = {};
        // }
        const { message: response, valid } = await this._readMessageFromStream(
            stream,
            this.isResponseValid.bind(this),
            remotePeerId._idB58String,
        );
        this.logger.trace(
            `Receiving response from ${remotePeerId._idB58String} : event=${protocol}, messageType=${response.header.messageType};`,
        );

        return valid ? response : null;
    }

    async sendMessageResponse(protocol, remotePeerId, messageType, handlerId, keyword, message) {
        this.logger.debug(
            `Sending response from ${this.config.id} to ${remotePeerId}: event=${protocol}, messageType=${messageType};`,
        );
        const stream = this.getSessionStream(handlerId, keyword, remotePeerId);

        if (!stream) {
            throw Error(`Unable to find opened stream for remotePeerId: ${remotePeerId}`);
        }

        const response = this.createStreamMessage(message, handlerId, keyword, messageType);

        await this._sendMessageToStream(stream, response);
    }

    // updateReceiverSession(header) {
    //     // if BUSY we expect same request, so don't update session
    //     if (header.messageType === constants.NETWORK_MESSAGE_TYPES.RESPONSES.BUSY) return;
    //     // if NACK we don't expect other requests, so delete session
    //     if (header.messageType === constants.NETWORK_MESSAGE_TYPES.RESPONSES.NACK) {
    //         if (header.sessionId) delete this.sessions.receiver[header.sessionId];
    //         return;
    //     }
    //
    //     // if session is new, initialise array of expected message types
    //     if (!this.sessions.receiver[header.sessionId].expectedMessageTypes) {
    //         this.sessions.receiver[header.sessionId].expectedMessageTypes = Object.keys(
    //             constants.NETWORK_MESSAGE_TYPES.REQUESTS,
    //         );
    //     }
    //
    //     // subroutine completed
    //     if (header.messageType === constants.NETWORK_MESSAGE_TYPES.RESPONSES.ACK) {
    //         // protocol operation completed, delete session
    //         if (this.sessions.receiver[header.sessionId].expectedMessageTypes.length <= 1) {
    //             this.removeSession(header.sessionId);
    //         } else {
    //             // operation not completed, update array of expected message types
    //             this.sessions.receiver[header.sessionId].expectedMessageTypes =
    //                 this.sessions.receiver[header.sessionId].expectedMessageTypes.slice(1);
    //         }
    //     }
    // }

    async _sendMessageToStream(stream, message) {
        const stringifiedHeader = JSON.stringify(message.header);
        const stringifiedData = JSON.stringify(message.data);

        let chunks = [stringifiedHeader];
        const chunkSize = 1024 * 1024; // 1 MB

        // split data into 1 MB chunks
        for (let i = 0; i < stringifiedData.length; i += chunkSize) {
            chunks.push(stringifiedData.slice(i, i + chunkSize));
        }

        await pipe(
            chunks,
            // turn strings into buffers
            (source) => map(source, (string) => Buffer.from(string)),
            // Encode with length prefix (so receiving side knows how much data is coming)
            lp.encode(),
            // Write to the stream (the sink)
            stream.sink,
        );
    }

    async _readMessageFromStream(stream, isMessageValid, remotePeerId) {
        return pipe(
            // Read from the stream (the source)
            stream.source,
            // Decode length-prefixed data
            lp.decode(),
            // Turn buffers into strings
            (source) => map(source, (buf) => buf.toString()),
            // Sink function
            (source) => this.readMessageSink(source, isMessageValid, remotePeerId),
        );
    }

    async readMessageSink(source, isMessageValid, remotePeerId) {
        let message = {};
        let stringifiedData = '';
        // we expect first buffer to be header
        const stringifiedHeader = (await source.next()).value;
        message.header = JSON.parse(stringifiedHeader);

        // validate request / response
        if (!(await isMessageValid(message.header, remotePeerId))) {
            return { message, valid: false };
        }

        // business check if PROTOCOL_INIT message
        if (
            message.header.messageType === constants.NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT &&
            this.isBusy()
        ) {
            return { message, valid: true, busy: true };
        }

        // read data the data
        for await (const chunk of source) {
            stringifiedData += chunk;
        }
        message.data = JSON.parse(stringifiedData);

        return { message, valid: true, busy: false };
    }

    async isRequestValid(header, remotePeerId) {
        // filter spam requests
        if (await this.limitRequest(header, remotePeerId)) return false;

        // header well formed
        if (
            !header.handlerId ||
            !header.keyword ||
            !header.messageType ||
            !Object.keys(constants.NETWORK_MESSAGE_TYPES.REQUESTS).includes(header.messageType)
        )
            return false;
        if (header.messageType === constants.NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT) {
            return true;
        } else {
            return this.sessionExists(remotePeerId, header.handlerId, header.keyword);
        }
    }

    sessionExists(remotePeerId, handlerId, keyword) {
        return true;
        // return this.sessions[remotePeerId._idB58String] && this.sessions[remotePeerId._idB58String][handlerId];
    }

    async isResponseValid(header, remotePeerId) {
        return true;
        // return (
        //     header.handlerId &&
        //     header.messageType &&
        //     this.sessions[remotePeerId][header.handlerId] &&
        //     Object.keys(constants.NETWORK_MESSAGE_TYPES.RESPONSES).includes(header.messageType)
        // );
    }

    removeSession(sessionId) {
        if (this.sessions.sender[sessionId]) {
            delete this.sessions.sender[sessionId];
        } else if (this.sessions.receiver[sessionId]) {
            delete this.sessions.receiver[sessionId];
        }
    }

    healthCheck() {
        // TODO: broadcast ping or sent msg to yourself
        const connectedNodes = this.node.connectionManager.size;
        if (connectedNodes > 0) return true;
        return false;
    }

    async limitRequest(header, remotePeerId) {
        // if (header.sessionId && this.sessions.receiver[header.sessionId]) return false;

        if (this.blackList[remotePeerId]) {
            const remainingMinutes = Math.floor(
                constants.NETWORK_API_BLACK_LIST_TIME_WINDOW_MINUTES -
                    (Date.now() - this.blackList[remotePeerId]) / (1000 * 60),
            );

            if (remainingMinutes > 0) {
                this.logger.debug(
                    `Blocking request from ${remotePeerId}. Node is blacklisted for ${remainingMinutes} minutes.`,
                );

                return true;
            } else {
                delete this.blackList[remotePeerId];
            }
        }

        if (await this.rateLimiter.spamDetection.limit(remotePeerId)) {
            this.blackList[remotePeerId] = Date.now();
            this.logger.debug(
                `Blocking request from ${remotePeerId}. Spammer detected and blacklisted for ${constants.NETWORK_API_BLACK_LIST_TIME_WINDOW_MINUTES} minutes.`,
            );

            return true;
        } else if (await this.rateLimiter.basicRateLimiter.limit(remotePeerId)) {
            this.logger.debug(
                `Blocking request from ${remotePeerId}. Max number of requests exceeded.`,
            );

            return true;
        }

        return false;
    }

    isBusy() {
        return toobusy() || Object.keys(this.sessions).length > constants.MAX_OPEN_SESSIONS;
    }

    getPrivateKey() {
        return this.config.privateKey;
    }

    getName() {
        return 'Libp2p';
    }
}

module.exports = Libp2pService;
