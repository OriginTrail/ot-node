const Libp2p = require('libp2p');
const { Record } = require('libp2p-record');
const KadDHT = require('libp2p-kad-dht');
const Bootstrap = require('libp2p-bootstrap');
const { NOISE } = require('libp2p-noise');
const MPLEX = require('libp2p-mplex');
const TCP = require('libp2p-tcp');
const pipe = require('it-pipe');
const lp = require('it-length-prefixed');
const { fromString: uint8ArrayFromString } = require('uint8arrays/from-string');
const { toString: uint8ArrayToString } = require('uint8arrays/to-string');
const map = require('it-map');
const { sha256 } = require('multiformats/hashes/sha2');
const PeerId = require('peer-id');
const { InMemoryRateLimiter } = require('rolling-rate-limiter');
const constants = require('../../../../modules/constants');

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

const messages = {
    PROTOCOL_INIT: ['INIT_ACK', 'INIT_NACK'],
    PROTOCOL_REQUEST: ['REQUEST_ACK', 'REQUEST_NACK'],
};
const messageTypes = {
    REQUESTS: ['PROTOCOL_INIT', 'PROTOCOL_REQUEST'],
    RESPONSES: ['INIT_ACK', 'INIT_NACK', 'REQUEST_ACK', 'REQUEST_NACK'],
};

let sessions = {
    sender: {},
    receiver: {},
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
        this.node = await Libp2p.create(initializationObject);
        this._initializeNodeListeners();
        await this.node.start();
        const port = parseInt(this.node.multiaddrs.toString().split('/')[4], 10);
        const peerId = this.node.peerId._idB58String;
        this.config.id = peerId;
        this.logger.info(`Network ID is ${peerId}, connection port is ${port}`);
        return {
            peerId: this.config.peerId,
            privateKey: this.config.privateKey,
        };
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
        this.logger.debug(`Node ${this.node.peerId._idB58String} discovered ${peer._idB58String}`);
    }

    _onPeerConnect(connection) {
        this.logger.debug(
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
        this.logger.info(`Found ${result.size} nodes`);

        return [...result];
    }

    getPeers() {
        return this.node.connectionManager.connections;
    }

    getPeerId() {
        return this.node.peerId._idB58String;
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
            const message = await this._readMessageFromStream(stream, this.isRequestValid);

            if (message) {
                this.logger.info(
                    `Receiving message from ${remotePeerId} to ${this.config.id}: event=${protocol}, messageType=${message.header.messageType};`,
                );
                this.updateSessionStream(message, stream);
                await handler(message, remotePeerId);
            }
        });
    }

    updateSessionStream(message, stream) {
        const session = sessions.receiver[message.header.sessionId];

        sessions.receiver[message.header.sessionId] = session ? { ...session, stream } : { stream };
    }

    async sendMessage(protocol, remotePeerId, message, options) {
        this.logger.info(
            `Sending message from ${this.config.id} to ${remotePeerId._idB58String}: event=${protocol}, messageType=${message.header.messageType};`,
        );
        const { stream } = await this.node.dialProtocol(remotePeerId, protocol);

        await this._sendMessageToStream(stream, message);
        this.updateSenderSession(message.header);
        const response = await this._readMessageFromStream(stream, this.isResponseValid);
        this.logger.info(
            `Receiving response from ${remotePeerId._idB58String} : event=${protocol}, messageType=${response.header.messageType};`,
        );

        return response;
    }

    async sendMessageResponse(protocol, remotePeerId, response, options) {
        this.logger.info(
            `Sending response from ${this.config.id} to ${remotePeerId}: event=${protocol}, messageType=${response.header.messageType};`,
        );
        await this._sendMessageToStream(
            sessions.receiver[response.header.sessionId].stream,
            response,
        );
        this.updateReceiverSession(response.header);
    }

    updateSenderSession(header) {
        sessions.sender[header.sessionId] = {
            expectedResponses: messages[header.messageType],
        };
    }

    updateReceiverSession(header) {
        let session = sessions.receiver[header.sessionId];
        if (!session.expectedMessageTypes) {
            session.expectedMessageTypes = messageTypes.REQUESTS;
        }
        // subroutine completed
        if (header.messageType.endsWith('_ACK')) {
            // protocol operation completed
            if (session.expectedMessageTypes.length <= 1) {
                console.log("deleting")
                delete sessions.receiver[header.sessionId];
                console.log(JSON.stringify(sessions, null, 2))
            } else {
                // operation not completed, update expected message types
                session.expectedMessageTypes = session.expectedMessageTypes.slice(1);
            }
        }

        sessions.receiver[header.sessionId] = session;
    }

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

    async _readMessageFromStream(stream, isMessageValid) {
        return pipe(
            // Read from the stream (the source)
            stream.source,
            // Decode length-prefixed data
            lp.decode(),
            // Turn buffers into strings
            (source) => map(source, (buf) => buf.toString()),
            // Sink function
            async function (source) {
                let message = {};
                let stringifiedData = '';
                // we expect first buffer to be header
                const stringifiedHeader = (await source.next()).value;
                message.header = JSON.parse(stringifiedHeader);

                if (!isMessageValid(message.header)) {
                    stream.close();
                    return;
                }

                for await (const chunk of source) {
                    stringifiedData += chunk;
                }
                message.data = JSON.parse(stringifiedData);

                return message;
            },
        );
    }

    isRequestValid(header) {
        // header well formed
        if (
            !header.sessionId ||
            !header.messageType ||
            !messageTypes.REQUESTS.includes(header.messageType)
        )
            return false;

        // get existing expected messageType or PROTOCOL_INIT if session doesn't exist yet
        const expectedMessageType = sessions.receiver[header.sessionId]
            ? sessions.receiver[header.sessionId].expectedMessageTypes[0]
            : Object.keys(messages)[0];

        return expectedMessageType === header.messageType;
    }

    isResponseValid(header) {
        // header well formed
        if (
            !header.sessionId ||
            !header.messageType ||
            !sessions.sender[header.sessionId] ||
            !messageTypes.RESPONSES.includes(header.messageType)
        )
            return false;

        const expectedResponses = sessions.sender[header.sessionId].expectedResponses;

        return expectedResponses.includes(header.messageType);
    }

    removeSession(sessionId) {
        if(sessions.sender[sessionId]) {
            delete sessions.sender[sessionId]
        } else if(sessions.receiver[sessionId]){
            delete sessions.receiver[sessionId]
        }
    }

    healthCheck() {
        // TODO: broadcast ping or sent msg to yourself
        const connectedNodes = this.node.connectionManager.size;
        if (connectedNodes > 0) return true;
        return false;
    }

    async limitRequest(remotePeerId) {
        if (this.blackList[remotePeerId]) {
            const remainingMinutes = Math.floor(
                constants.NETWORK_API_BLACK_LIST_TIME_WINDOW_MINUTES -
                    (Date.now() - this.blackList[remotePeerId]) / (1000 * 60),
            );

            if (remainingMinutes > 0) {
                this.logger.info(
                    `Blocking request from ${remotePeerId}. Node is blacklisted for ${remainingMinutes} minutes.`,
                );

                return true;
            } else {
                delete this.blackList[remotePeerId];
            }
        }

        if (await this.rateLimiter.spamDetection.limit(remotePeerId)) {
            this.blackList[remotePeerId] = Date.now();
            this.logger.info(
                `Blocking request from ${remotePeerId}. Spammer detected and blacklisted for ${constants.NETWORK_API_BLACK_LIST_TIME_WINDOW_MINUTES} minutes.`,
            );

            return true;
        } else if (await this.rateLimiter.basicRateLimiter.limit(remotePeerId)) {
            this.logger.info(
                `Blocking request from ${remotePeerId}. Max number of requests exceeded.`,
            );

            return true;
        }

        return false;
    }

    getPrivateKey() {
        return this.node.peerId.privKey;
    }

    getName() {
        return 'Libp2p';
    }
}

module.exports = Libp2pService;
