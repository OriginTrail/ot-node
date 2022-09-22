/* eslint-disable import/no-unresolved */
import { createLibp2p } from 'libp2p';
import { sha256 } from 'multiformats/hashes/sha2';
import { Multiaddr } from '@multiformats/multiaddr';
import { Bootstrap } from '@libp2p/bootstrap';
import { Mplex } from '@libp2p/mplex';
import { Noise } from '@chainsafe/libp2p-noise';
import { KadDHT } from '@libp2p/kad-dht';
import { TCP } from '@libp2p/tcp';
import { pipe } from 'it-pipe';
import * as lp from 'it-length-prefixed';
import { unmarshalPrivateKey } from '@libp2p/crypto/keys';
import { toString as uint8ArrayToString } from 'uint8arrays/to-string';
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string';
import { xor as uint8ArrayXor } from 'uint8arrays/xor';
import { compare as uint8ArrayCompare } from 'uint8arrays/compare';
import map from 'it-map';
import { createFromPrivKey, createRSAPeerId } from '@libp2p/peer-id-factory';
import { peerIdFromString } from '@libp2p/peer-id';
import { InMemoryRateLimiter } from 'rolling-rate-limiter';
import toobusy from 'toobusy-js';
import { v5 as uuidv5 } from 'uuid';
import { PeerSet } from '@libp2p/peer-collections';
import filter from 'it-filter';
import merge from 'it-merge';
import all from 'it-all';
import each from 'it-foreach';
import sort from 'it-sort';
import take from 'it-take';

import ip from 'ip';
import os from 'os';
import {
    NETWORK_API_RATE_LIMIT,
    NETWORK_API_SPAM_DETECTION,
    NETWORK_MESSAGE_TYPES,
    NETWORK_API_BLACK_LIST_TIME_WINDOW_MINUTES,
    DHT_TYPES,
} from '../../../constants/constants.js';

const initializationObject = {
    addresses: {
        listen: ['/ip4/0.0.0.0/tcp/9000'],
    },
    streamMuxers: [new Mplex()],
    connectionEncryption: [new Noise()],
};

class Libp2pService {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;

        initializationObject.transports = [this._initializeTCP(this.config.publicIp)];
        initializationObject.dht = this._initializeDHT(this.config.dht);
        initializationObject.peerRouting = this.config.peerRouting;
        initializationObject.connectionManager = this.config.connectionManager;

        if (this.config.bootstrap.length > 0) {
            initializationObject.peerDiscovery = [
                new Bootstrap({
                    interval: 60e3,
                    list: this.config.bootstrap,
                }),
            ];
        }
        initializationObject.addresses = {
            listen: [`/ip4/0.0.0.0/tcp/${this.config.port}`], // for production
            // announce: ['/dns4/auto-relay.libp2p.io/tcp/443/wss/p2p/QmWDn2LY8nannvSWJzruUYoLZ4vV83vfCBwd8DipvdgQc3']
        };
        let id;
        if (!this.config.peerId) {
            if (!this.config.privateKey) {
                id = await createRSAPeerId({ bits: 1024 });
                this.config.privateKey = uint8ArrayToString(id.privateKey, 'base64pad');
            } else {
                const encoded = uint8ArrayFromString(this.config.privateKey, 'base64pad');
                id = await createFromPrivKey(await unmarshalPrivateKey(encoded));
            }
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
        this.node = await createLibp2p(initializationObject);
        this._initializeNodeListeners();
        await this.node.start();
        const port = parseInt(this.node.getMultiaddrs().toString().split('/')[4], 10);

        this.config.id = this.node.peerId.toString();
        this.logger.info(
            `Network ID is ${this.node.peerId.toString()}, connection port is ${port}`,
        );
    }

    _initializeNodeListeners() {
        this.node.connectionManager.addEventListener('peer:connect', async (connection) => {
            this.logger.trace(
                `Node ${this.node.peerId.toString()} connected to ${connection.detail.remotePeer.toString()}`,
            );
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

    _initializeDHT(dhtConfig) {
        const dhtTypes = Object.values(DHT_TYPES);

        if (
            !dhtConfig?.type ||
            typeof dhtConfig.type !== 'string' ||
            !dhtTypes.includes(dhtConfig.type)
        )
            throw Error(`Invalid dht type found in config. Allowed dht types: ${dhtTypes}`);

        const dualKadDht = new KadDHT({ kBucketSize: dhtConfig?.kBucketSize, clientMode: false });
        this.dhtType = dhtConfig.type.toLowerCase();

        if (this.dhtType === DHT_TYPES.WAN) return dualKadDht.wan;
        if (this.dhtType === DHT_TYPES.LAN) return dualKadDht.lan;
        return dualKadDht;
    }

    _initializeTCP(publicIp) {
        if (process.env.NODE_ENV !== 'testnet') return new TCP();

        for (const [, netAddrs] of Object.entries(os.networkInterfaces())) {
            if (netAddrs != null) {
                for (const netAddr of netAddrs) {
                    if (netAddr.family === 'IPv4') {
                        if (!ip.isPrivate(netAddr.address)) {
                            return new TCP();
                        }
                    }
                }
            }
        }

        if (!publicIp) {
            throw Error(
                "Public Ip not found. Please specify your node's public ip in the config file.",
            );
        }
        if (!ip.isV4Format(publicIp)) {
            throw Error('Specified Ip must be in v4 format.');
        }
        if (!ip.isPublic(publicIp)) {
            throw Error('Specified Ip must be public.');
        }

        return new TCP({ publicIp });
    }

    async serializePeer(peerId) {
        const [multiaddrs, protocols] = await Promise.all([
            this.node.peerStore.addressBook.get(peerId),
            this.node.peerStore.protoBook.get(peerId),
        ]);

        return {
            id: peerId.toString(),
            multiaddrs: (multiaddrs ?? []).map((addr) => addr.multiaddr),
            protocols: protocols ?? [],
        };
    }

    async serializePeers(peerIds) {
        return Promise.all(peerIds.map((peerId) => this.serializePeer(peerId)));
    }

    async deserializePeer(serializedPeer) {
        const peerId = peerIdFromString(serializedPeer.id);
        const multiaddrs = serializedPeer.multiaddrs.map((addr) => new Multiaddr(addr));

        await Promise.all([
            this.node.peerStore.addressBook.add(peerId, multiaddrs),
            this.node.peerStore.protoBook.add(peerId, serializedPeer.protocols),
        ]);

        return {
            id: peerId,
            multiaddrs: serializedPeer.multiaddrs ?? [],
            protocols: serializedPeer.protocols ?? [],
        };
    }

    async deserializePeers(serializedPeers) {
        return Promise.all(serializedPeers.map((peer) => this.deserializePeer(peer)));
    }

    async sortPeerIds(key, peerIds, count = this.config.kBucketSize) {
        const keyHash = await this.toHash(new TextEncoder().encode(key));
        const sorted = pipe(
            peerIds,
            (source) =>
                map(source, async (peerId) => ({
                    peerId,
                    distance: uint8ArrayXor(keyHash, await this.toHash(peerId.toBytes())),
                })),
            (source) => sort(source, (a, b) => uint8ArrayCompare(a.distance, b.distance)),
            (source) => take(source, count),
            (source) => map(source, (pd) => pd.peerId),
        );

        return all(sorted);
    }

    async toHash(encodedKey) {
        return Buffer.from((await sha256.digest(encodedKey)).digest);
    }

    async findNodesLocal(key) {
        const encodedKey = new TextEncoder().encode(key);
        const keyHash = Buffer.from((await sha256.digest(encodedKey)).digest);

        if (this.dhtType === DHT_TYPES.DUAL) {
            const peers = await all(
                merge(
                    this.node.dht.wan.routingTable.closestPeers(keyHash, this.config.kBucketSize),
                    this.node.dht.lan.routingTable.closestPeers(keyHash, this.config.kBucketSize),
                ),
            );

            return this.sortPeerIds(key, new PeerSet(peers));
        }

        return this.node.dht.routingTable.closestPeers(keyHash, this.config.kBucketSize);
    }

    async findNodes(key) {
        const encodedKey = new TextEncoder().encode(key);
        const self = this;
        const peers = await all(
            pipe(
                self.node.dht.getClosestPeers(encodedKey),
                (source) => filter(source, (event) => event.name === 'FINAL_PEER'),
                (source) =>
                    each(source, async (event) => {
                        await self.node.peerStore.addressBook.add(
                            event.peer.id,
                            event.peer.multiaddrs,
                        );
                    }),
                (source) => map(source, async (event) => event.peer.id),
            ),
        );

        return this.dhtType === DHT_TYPES.DUAL ? this.sortPeerIds(key, new PeerSet(peers)) : peers;
    }

    getPeers() {
        return this.node.connectionManager.connections;
    }

    getPeerId() {
        return this.node.peerId;
    }

    getMultiAddrs() {
        return this.node.getMultiaddrs();
    }

    async handleMessage(protocol, handler) {
        this.logger.info(`Enabling network protocol: ${protocol}`);

        await this.node.handle(protocol, async (handlerProps) => {
            const { stream } = handlerProps;
            const remotePeerId = handlerProps.connection.remotePeer.toString();
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
            `Sending message to ${remotePeerId.toString()}: event=${protocol}, messageType=${messageType}, operationId: ${operationId}, keywordUuid: ${keywordUuid}`,
        );

        // const sessionStream = this.getSessionStream(operationId, remotePeerId.toString());
        // if (!sessionStream) {
        this.logger.trace(
            `Dialing remotePeerId: ${remotePeerId.toString()} for protocol: ${protocol}`,
        );
        let stream;
        try {
            stream = await this.node.dialProtocol(remotePeerId, protocol);
        } catch (error) {
            throw Error(
                `Unable to dial peer: ${remotePeerId.toString()} with protocol: ${protocol}. Error: ${
                    error.message
                }`,
            );
        }
        // } else {
        //     stream = sessionStream;
        // }

        this.updateSessionStream(operationId, keywordUuid, remotePeerId.toString(), stream);

        const streamMessage = this.createStreamMessage(
            message,
            operationId,
            keywordUuid,
            messageType,
        );
        await this._sendMessageToStream(stream, streamMessage);
        // if (!this.sessions[remotePeerId.toString()]) {
        //     this.sessions[remotePeerId.toString()] = {
        //         [operationId]: {
        //             stream
        //         }
        //     }
        // } else {
        //     this.sessions[remotePeerId.toString()][operationId] = {
        //             stream
        //     }
        // }
        // if (!this.sessions.sender[message.header.sessionId]) {
        //     this.sessions.sender[message.header.sessionId] = {};
        // }
        const { message: response, valid } = await this._readMessageFromStream(
            stream,
            this.isResponseValid.bind(this),
            remotePeerId.toString(),
        );

        this.logger.trace(
            `Receiving response from ${remotePeerId.toString()} : event=${protocol}, messageType=${
                response.header.messageType
            };`,
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
            (source) => map(source, (string) => uint8ArrayFromString(string)),
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
            (source) => map(source, (buf) => uint8ArrayToString(buf.subarray())),
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
        // return this.sessions[remotePeerId.toString()] && this.sessions[remotePeerId.toString()][operationId];
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
