import Libp2p from 'libp2p';
import { Record } from 'libp2p-record';
import KadDHT from 'libp2p-kad-dht';
import Bootstrap, { tag } from 'libp2p-bootstrap';
import { NOISE } from 'libp2p-noise';
import MPLEX from 'libp2p-mplex';
import TCP from 'libp2p-tcp';
import pipe from 'it-pipe';
import { encode, decode } from 'it-length-prefixed';
import map from 'it-map';
import { create, createFromPrivKey } from 'peer-id';
import { InMemoryRateLimiter } from 'rolling-rate-limiter';
import toobusy from 'toobusy-js';
import { v5 as uuidv5 } from 'uuid';
import {
    NETWORK_API_RATE_LIMIT,
    NETWORK_API_SPAM_DETECTION,
    NETWORK_MESSAGE_TYPES,
    NETWORK_API_BLACK_LIST_TIME_WINDOW_MINUTES,
} from '../../../constants/constants.js';

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
                [tag]: {
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
                id = await create({ bits: 1024, keyType: 'RSA' });
                privKey = id.toJSON().privKey;
            } else {
                privKey = this.config.privateKey;
                id = await createFromPrivKey(this.config.privateKey);
            }
            this.config.privateKey = privKey;
            this.config.peerId = id;
        }

        initializationObject.peerId = this.config.peerId;
        this._initializeRateLimiters();
        /**
         * sessions = {
         *     [peerId]: {
         *         [operationId]: {
         *             [keywordUuid] : {
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
            interval: NETWORK_API_RATE_LIMIT.TIME_WINDOW_MILLS,
            maxInInterval: NETWORK_API_RATE_LIMIT.MAX_NUMBER,
        });

        const spamDetection = new InMemoryRateLimiter({
            interval: NETWORK_API_SPAM_DETECTION.TIME_WINDOW_MILLS,
            maxInInterval: NETWORK_API_SPAM_DETECTION.MAX_NUMBER,
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
        const nodes = this.node._dht.peerRouting.getClosestPeers(encodedKey);
        const result = [];
        for await (const node of nodes) {
            if (this.node.peerStore.peers.get(node._idB58String).protocols.includes(protocol)) {
                result.push(node);
            }
        }

        return result;
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

    async handleMessage(protocol, handler) {
        this.logger.info(`Enabling network protocol: ${protocol}`);

        this.node.handle(protocol, async (handlerProps) => {
            const { stream } = handlerProps;
            const remotePeerId = handlerProps.connection.remotePeer._idB58String;
            const { message, valid, busy } = await this._readMessageFromStream(
                stream,
                this.isRequestValid.bind(this),
                remotePeerId,
            );

            this.updateSessionStream(
                message.header.operationId,
                message.header.keywordUuid,
                remotePeerId,
                stream,
            );

            if (!valid) {
                await this.sendMessageResponse(
                    protocol,
                    remotePeerId,
                    NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                    message.header.operationId,
                    message.header.keywordUuid,
                    {},
                );
            } else if (busy) {
                await this.sendMessageResponse(
                    protocol,
                    remotePeerId,
                    NETWORK_MESSAGE_TYPES.RESPONSES.BUSY,
                    message.header.operationId,
                    message.header.keywordUuid,
                    {},
                );
            } else {
                this.logger.debug(
                    `Receiving message from ${remotePeerId} to ${this.config.id}: event=${protocol}, messageType=${message.header.messageType};`,
                );
                await handler(message, remotePeerId);
            }
        });
    }

    updateSessionStream(operationId, keywordUuid, remotePeerId, stream) {
        this.logger.trace(
            `Storing new session stream for remotePeerId: ${remotePeerId} with operation id: ${operationId}, keywordUuid: ${keywordUuid}`,
        );
        if (!this.sessions[remotePeerId]) {
            this.sessions[remotePeerId] = {
                [operationId]: {
                    [keywordUuid]: {
                        stream,
                    },
                },
            };
        } else if (!this.sessions[remotePeerId][operationId]) {
            this.sessions[remotePeerId][operationId] = {
                [keywordUuid]: {
                    stream,
                },
            };
        } else {
            this.sessions[remotePeerId][operationId][keywordUuid] = {
                stream,
            };
        }
    }

    getSessionStream(operationId, keywordUuid, remotePeerId) {
        if (
            this.sessions[remotePeerId] &&
            this.sessions[remotePeerId][operationId] &&
            this.sessions[remotePeerId][operationId][keywordUuid]
        ) {
            this.logger.trace(
                `Session found remotePeerId: ${remotePeerId}, operation id: ${operationId}, keywordUuid: ${keywordUuid}`,
            );
            return this.sessions[remotePeerId][operationId][keywordUuid].stream;
        }
        return null;
    }

    createStreamMessage(message, operationId, keywordUuid, messageType) {
        return {
            header: {
                messageType,
                operationId,
                keywordUuid,
            },
            data: message,
        };
    }

    async sendMessage(protocol, remotePeerId, messageType, operationId, keyword, message) {
        const keywordUuid = uuidv5(keyword, uuidv5.URL);

        this.logger.trace(
            `Sending message to ${remotePeerId._idB58String}: event=${protocol}, messageType=${messageType}, operationId: ${operationId}, keywordUuid: ${keywordUuid}`,
        );

        // const sessionStream = this.getSessionStream(operationId, remotePeerId._idB58String);
        // if (!sessionStream) {
        this.logger.trace(
            `Dialing remotePeerId: ${remotePeerId._idB58String} for protocol: ${protocol}`,
        );
        const { stream } = await this.node.dialProtocol(remotePeerId, protocol);
        // } else {
        //     stream = sessionStream;
        // }

        this.updateSessionStream(operationId, keywordUuid, remotePeerId._idB58String, stream);

        const streamMessage = this.createStreamMessage(
            message,
            operationId,
            keywordUuid,
            messageType,
        );

        await this._sendMessageToStream(stream, streamMessage);
        // if (!this.sessions[remotePeerId._idB58String]) {
        //     this.sessions[remotePeerId._idB58String] = {
        //         [operationId]: {
        //             stream
        //         }
        //     }
        // } else {
        //     this.sessions[remotePeerId._idB58String][operationId] = {
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

    async sendMessageResponse(
        protocol,
        remotePeerId,
        messageType,
        operationId,
        keywordUuid,
        message,
    ) {
        this.logger.debug(
            `Sending response from ${this.config.id} to ${remotePeerId}: event=${protocol}, messageType=${messageType};`,
        );
        const stream = this.getSessionStream(operationId, keywordUuid, remotePeerId);

        if (!stream) {
            throw Error(`Unable to find opened stream for remotePeerId: ${remotePeerId}`);
        }

        const response = this.createStreamMessage(message, operationId, keywordUuid, messageType);

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

        const chunks = [stringifiedHeader];
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
            encode(),
            // Write to the stream (the sink)
            stream.sink,
        );
    }

    async _readMessageFromStream(stream, isMessageValid, remotePeerId) {
        return pipe(
            // Read from the stream (the source)
            stream.source,
            // Decode length-prefixed data
            decode(),
            // Turn buffers into strings
            (source) => map(source, (buf) => buf.toString()),
            // Sink function
            (source) => this.readMessageSink(source, isMessageValid, remotePeerId),
        );
    }

    async readMessageSink(source, isMessageValid, remotePeerId) {
        const message = {};
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
            message.header.messageType === NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT &&
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
            !header.operationId ||
            !header.keywordUuid ||
            !header.messageType ||
            !Object.keys(NETWORK_MESSAGE_TYPES.REQUESTS).includes(header.messageType)
        )
            return false;
        if (header.messageType === NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT) {
            return true;
        }

        return this.sessionExists(remotePeerId, header.operationId, header.keywordUuid);
    }

    sessionExists() {
        return true;
        // return this.sessions[remotePeerId._idB58String] && this.sessions[remotePeerId._idB58String][operationId];
    }

    async isResponseValid() {
        return true;
        // return (
        //     header.operationId &&
        //     header.messageType &&
        //     this.sessions[remotePeerId][header.operationId] &&
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
                NETWORK_API_BLACK_LIST_TIME_WINDOW_MINUTES -
                    (Date.now() - this.blackList[remotePeerId]) / (1000 * 60),
            );

            if (remainingMinutes > 0) {
                this.logger.debug(
                    `Blocking request from ${remotePeerId}. Node is blacklisted for ${remainingMinutes} minutes.`,
                );

                return true;
            }
            delete this.blackList[remotePeerId];
        }

        if (await this.rateLimiter.spamDetection.limit(remotePeerId)) {
            this.blackList[remotePeerId] = Date.now();
            this.logger.debug(
                `Blocking request from ${remotePeerId}. Spammer detected and blacklisted for ${NETWORK_API_BLACK_LIST_TIME_WINDOW_MINUTES} minutes.`,
            );

            return true;
        }
        if (await this.rateLimiter.basicRateLimiter.limit(remotePeerId)) {
            this.logger.debug(
                `Blocking request from ${remotePeerId}. Max number of requests exceeded.`,
            );

            return true;
        }

        return false;
    }

    isBusy() {
        const distinctOperations = new Set();
        for (const peerId in this.sessions) {
            for (const operationId in Object.keys(this.sessions[peerId])) {
                distinctOperations.add(operationId);
            }
        }
        return toobusy(); // || distinctOperations.size > constants.MAX_OPEN_SESSIONS;
    }

    getPrivateKey() {
        return this.config.privateKey;
    }

    getName() {
        return 'Libp2p';
    }
}

export default Libp2pService;
