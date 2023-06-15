/* eslint-disable import/no-unresolved */
import appRootPath from 'app-root-path';
import { join } from 'path';
import { tcp } from '@libp2p/tcp';
import { mplex } from '@libp2p/mplex';
import { noise } from '@chainsafe/libp2p-noise';
import { bootstrap } from '@libp2p/bootstrap';
import { kadDHT } from '@libp2p/kad-dht';
import { createFromPrivKey, createRSAPeerId } from '@libp2p/peer-id-factory';
import { peerIdFromString } from '@libp2p/peer-id';
import { keys } from '@libp2p/crypto';
import { createLibp2p } from 'libp2p';
import { identifyService } from 'libp2p/identify';
import { autoNATService } from 'libp2p/autonat';
import { uPnPNATService } from 'libp2p/upnp-nat';
import { pipe } from 'it-pipe';
import map from 'it-map';
import { encode, decode } from 'it-length-prefixed';
import { fromString as uint8ArrayFromString, toString as uint8ArrayToString } from 'uint8arrays';
import { InMemoryRateLimiter } from 'rolling-rate-limiter';
import toobusy from 'toobusy-js';
import { mkdir, writeFile, readFile, stat } from 'fs/promises';
import ip from 'ip';
import {
    NETWORK_API_RATE_LIMIT,
    NETWORK_API_SPAM_DETECTION,
    NETWORK_MESSAGE_TYPES,
    NETWORK_API_BLACK_LIST_TIME_WINDOW_MINUTES,
    LIBP2P_KEY_DIRECTORY,
    LIBP2P_KEY_FILENAME,
    NODE_ENVIRONMENTS,
    BYTES_IN_MEGABYTE,
} from '../../../constants/constants.js';

const devEnvironment =
    process.env.NODE_ENV === NODE_ENVIRONMENTS.DEVELOPMENT ||
    process.env.NODE_ENV === NODE_ENVIRONMENTS.TEST;

class Libp2pService {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;

        if (!this.config.peerId) {
            if (!devEnvironment || !this.config.privateKey) {
                this.config.privateKey = await this.readPrivateKeyFromFile();
            }

            if (!this.config.privateKey) {
                this.config.peerId = await createRSAPeerId({ bits: 1024 });
                this.config.privateKey = uint8ArrayToString(
                    this.config.peerId.privateKey,
                    'base64pad',
                );
                await this.savePrivateKeyInFile(this.config.privateKey);
            } else {
                this.config.peerId = await createFromPrivKey(
                    await keys.unmarshalPrivateKey(
                        uint8ArrayFromString(this.config.privateKey, 'base64pad'),
                    ),
                );
            }
        }

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
        this.node = await createLibp2p({
            addresses: {
                listen: [`/ip4/0.0.0.0/tcp/${this.config.port}`],
            },
            transports: [tcp()],
            streamMuxers: [mplex()],
            connectionEncryption: [noise()],
            peerDiscovery: [
                bootstrap({
                    list: this.config.bootstrap,
                    // wait 5 seconds to contact boostrap,
                    // to give time to sharding table service to initialize
                    timeout: 5_000,
                }),
            ],
            connectionManager: {
                ...this.config.connectionManager,
            },
            services: {
                dht: kadDHT(this.config.dht),
                identify: identifyService(),
                autonat: autoNATService(),
                uPnPNAT: uPnPNATService(),
            },
            peerId: this.config.peerId,
            start: true,
        });

        const port = parseInt(this.node.getMultiaddrs().toString().split('/')[4], 10);
        this.config.id = this.node.peerId.toString();
        this.logger.info(`Network ID is ${this.config.id}, connection port is ${port}`);
    }

    async onPeerConnected(listener) {
        this.node.addEventListener('peer:connect', listener);
    }

    async savePrivateKeyInFile(privateKey) {
        const { fullPath, directoryPath } = this.getKeyPath();
        await mkdir(directoryPath, { recursive: true });
        await writeFile(fullPath, privateKey);
    }

    getKeyPath() {
        let directoryPath;
        if (process.env.NODE_ENV === 'testnet' || process.env.NODE_ENV === 'mainnet') {
            directoryPath = join(
                appRootPath.path,
                '..',
                this.config.appDataPath,
                LIBP2P_KEY_DIRECTORY,
            );
        } else {
            directoryPath = join(appRootPath.path, this.config.appDataPath, LIBP2P_KEY_DIRECTORY);
        }

        const fullPath = join(directoryPath, LIBP2P_KEY_FILENAME);
        return { fullPath, directoryPath };
    }

    async readPrivateKeyFromFile() {
        const keyPath = this.getKeyPath();
        if (await this.fileExists(keyPath.fullPath)) {
            const key = (await readFile(keyPath.fullPath)).toString();
            return key;
        }
    }

    async fileExists(filePath) {
        try {
            await stat(filePath);
            return true;
        } catch (e) {
            return false;
        }
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

    getMultiaddrs() {
        return this.node.getMultiaddrs();
    }

    getPeerId() {
        return this.node.peerId;
    }

    getPeerIdString() {
        return this.config.id;
    }

    handleMessage(protocol, handler) {
        this.logger.info(`Enabling network protocol: ${protocol}`);

        this.node.handle(protocol, async (handlerProps) => {
            const { stream } = handlerProps;
            const peerIdString = handlerProps.connection.remotePeer.toString();
            const { message, valid, busy } = await this._readMessageFromStream(
                stream,
                this.isRequestValid.bind(this),
                peerIdString,
            );

            this.updateSessionStream(
                message.header.operationId,
                message.header.keywordUuid,
                peerIdString,
                stream,
            );

            if (!valid) {
                await this.sendMessageResponse(
                    protocol,
                    peerIdString,
                    NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                    message.header.operationId,
                    message.header.keywordUuid,
                    { errorMessage: 'Invalid request message' },
                );
                this.removeCachedSession(
                    message.header.operationId,
                    message.header.keywordUuid,
                    peerIdString,
                );
            } else if (busy) {
                await this.sendMessageResponse(
                    protocol,
                    peerIdString,
                    NETWORK_MESSAGE_TYPES.RESPONSES.BUSY,
                    message.header.operationId,
                    message.header.keywordUuid,
                    {},
                );
                this.removeCachedSession(
                    message.header.operationId,
                    message.header.keywordUuid,
                    peerIdString,
                );
            } else {
                this.logger.debug(
                    `Receiving message from ${peerIdString} to ${this.config.id}: protocol: ${protocol}, messageType: ${message.header.messageType};`,
                );
                await handler(message, peerIdString);
            }
        });
    }

    updateSessionStream(operationId, keywordUuid, peerIdString, stream) {
        this.logger.trace(
            `Storing new session stream for remotePeerId: ${peerIdString} with operation id: ${operationId}`,
        );
        if (!this.sessions[peerIdString]) {
            this.sessions[peerIdString] = {
                [operationId]: {
                    [keywordUuid]: {
                        stream,
                    },
                },
            };
        } else if (!this.sessions[peerIdString][operationId]) {
            this.sessions[peerIdString][operationId] = {
                [keywordUuid]: {
                    stream,
                },
            };
        } else {
            this.sessions[peerIdString][operationId][keywordUuid] = {
                stream,
            };
        }
    }

    getSessionStream(operationId, keywordUuid, peerIdString) {
        if (
            this.sessions[peerIdString] &&
            this.sessions[peerIdString][operationId] &&
            this.sessions[peerIdString][operationId][keywordUuid]
        ) {
            this.logger.trace(
                `Session found remotePeerId: ${peerIdString}, operation id: ${operationId}`,
            );
            return this.sessions[peerIdString][operationId][keywordUuid].stream;
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

    async sendMessage(
        protocol,
        peerIdString,
        messageType,
        operationId,
        keywordUuid,
        message,
        timeout,
    ) {
        const nackMessage = {
            header: { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK },
            data: {
                errorMessage: '',
            },
        };
        const peerIdObject = peerIdFromString(peerIdString);

        // const sessionStream = this.getSessionStream(operationId, remotePeerId.toB58String());
        // if (!sessionStream) {
        // } else {
        //     stream = sessionStream;
        // }

        const publicIp = ((await this.node.peerStore.get(peerIdObject)).addresses ?? [])
            .map((addr) => addr.multiaddr)
            .filter((addr) => addr.isThinWaistAddress())
            .map((addr) => addr.toString().split('/'))
            .filter((splittedAddr) => !ip.isPrivate(splittedAddr[2]))[0]?.[2];

        this.logger.trace(
            `Dialing remotePeerId: ${peerIdString} with public ip: ${publicIp}: protocol: ${protocol}, messageType: ${messageType} , operationId: ${operationId}`,
        );
        let dialResult;
        let dialStart;
        let dialEnd;
        try {
            dialStart = Date.now();
            dialResult = await this.node.dialProtocol(peerIdObject, protocol);
            dialEnd = Date.now();
        } catch (error) {
            dialEnd = Date.now();
            nackMessage.data.errorMessage = `Unable to dial peer: ${peerIdString}. protocol: ${protocol}, messageType: ${messageType} , operationId: ${operationId}, dial execution time: ${
                dialEnd - dialStart
            } ms. Error: ${error.message}`;

            return nackMessage;
        }
        this.logger.trace(
            `Created stream for peer: ${peerIdString}. protocol: ${protocol}, messageType: ${messageType} , operationId: ${operationId}, dial execution time: ${
                dialEnd - dialStart
            } ms.`,
        );
        const stream = dialResult;

        this.updateSessionStream(operationId, keywordUuid, peerIdString, stream);

        const streamMessage = this.createStreamMessage(
            message,
            operationId,
            keywordUuid,
            messageType,
        );

        this.logger.trace(
            `Sending message to ${peerIdString}. protocol: ${protocol}, messageType: ${messageType}, operationId: ${operationId}`,
        );

        let sendMessageStart;
        let sendMessageEnd;
        try {
            sendMessageStart = Date.now();
            await this._sendMessageToStream(stream, streamMessage);
            sendMessageEnd = Date.now();
        } catch (error) {
            sendMessageEnd = Date.now();
            nackMessage.data.errorMessage = `Unable to send message to peer: ${peerIdString}. protocol: ${protocol}, messageType: ${messageType}, operationId: ${operationId}, execution time: ${
                sendMessageEnd - sendMessageStart
            } ms. Error: ${error.message}`;

            return nackMessage;
        }

        let readResponseStart;
        let readResponseEnd;
        let response;
        const timeoutSignal = AbortSignal.timeout(timeout);
        const onAbort = async () => {
            stream.abort();
            response = null;
        };
        try {
            readResponseStart = Date.now();

            timeoutSignal.addEventListener('abort', onAbort, { once: true });

            response = await this._readMessageFromStream(
                stream,
                this.isResponseValid.bind(this),
                peerIdString,
            );

            timeoutSignal.removeEventListener('abort', onAbort);

            if (timeoutSignal.aborted) {
                throw Error('Message timed out!');
            }

            readResponseEnd = Date.now();
        } catch (error) {
            timeoutSignal.removeEventListener('abort', onAbort);

            readResponseEnd = Date.now();
            nackMessage.data.errorMessage = `Unable to read response from peer ${peerIdString}. protocol: ${protocol}, messageType: ${messageType} , operationId: ${operationId}, execution time: ${
                readResponseEnd - readResponseStart
            } ms. Error: ${error.message}`;

            return nackMessage;
        }

        this.logger.trace(
            `Receiving response from ${peerIdString}. protocol: ${protocol}, messageType: ${
                response.message?.header?.messageType
            }, operationId: ${operationId}, execution time: ${
                readResponseEnd - readResponseStart
            } ms.`,
        );

        if (!response.valid) {
            nackMessage.data.errorMessage = 'Invalid response';

            return nackMessage;
        }

        return response.message;
    }

    async sendMessageResponse(
        protocol,
        peerIdString,
        messageType,
        operationId,
        keywordUuid,
        message,
    ) {
        this.logger.debug(
            `Sending response from ${this.config.id} to ${peerIdString}: protocol: ${protocol}, messageType: ${messageType};`,
        );
        const stream = this.getSessionStream(operationId, keywordUuid, peerIdString);

        if (!stream) {
            throw Error(`Unable to find opened stream for remotePeerId: ${peerIdString}`);
        }

        const response = this.createStreamMessage(message, operationId, keywordUuid, messageType);

        await this._sendMessageToStream(stream, response);
    }

    async _sendMessageToStream(stream, message) {
        const stringifiedHeader = JSON.stringify(message.header);
        const stringifiedData = JSON.stringify(message.data);

        const chunks = [stringifiedHeader];
        const chunkSize = BYTES_IN_MEGABYTE; // 1 MB

        // split data into 1 MB chunks
        for (let i = 0; i < stringifiedData.length; i += chunkSize) {
            chunks.push(stringifiedData.slice(i, i + chunkSize));
        }

        await pipe(
            chunks,
            // turn strings into buffers
            (source) => map(source, (string) => uint8ArrayFromString(string)),
            // Encode with length prefix (so receiving side knows how much data is coming)
            (source) => encode(source),
            // Write to the stream (the sink)
            stream.sink,
        );
    }

    async _readMessageFromStream(stream, isMessageValid, peerIdString) {
        return pipe(
            // Read from the stream (the source)
            stream.source,
            // Decode length-prefixed data
            (source) => decode(source),
            // Turn buffers into strings
            (source) => map(source, (buf) => uint8ArrayToString(buf.subarray())),
            // Sink function
            (source) => this.readMessageSink(source, isMessageValid, peerIdString),
        );
    }

    async readMessageSink(source, isMessageValid, peerIdString) {
        const message = { header: { operationId: '', keywordUuid: '' }, data: {} };
        // we expect first buffer to be header
        const stringifiedHeader = (await source.next()).value;

        if (!stringifiedHeader?.length) {
            return { message, valid: false, busy: false };
        }

        message.header = JSON.parse(stringifiedHeader);

        // validate request / response
        if (!(await isMessageValid(message.header, peerIdString))) {
            return { message, valid: false };
        }

        // business check if PROTOCOL_INIT message
        if (
            message.header.messageType === NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT &&
            this.isBusy()
        ) {
            return { message, valid: true, busy: true };
        }

        let stringifiedData = '';
        // read data the data
        for await (const chunk of source) {
            stringifiedData += chunk;
        }
        message.data = JSON.parse(stringifiedData);

        return { message, valid: true, busy: false };
    }

    async isRequestValid(header, peerIdString) {
        // filter spam requests
        if (await this.limitRequest(header, peerIdString)) return false;

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

        return this.sessionExists(peerIdString, header.operationId, header.keywordUuid);
    }

    sessionExists() {
        return true;
    }

    async isResponseValid() {
        return true;
    }

    healthCheck() {
        // TODO: broadcast ping or sent msg to yourself
        const connectedNodes = this.node.connectionManager.size;
        if (connectedNodes > 0) return true;
        return false;
    }

    async limitRequest(header, peerIdString) {
        // if (header.sessionId && this.sessions.receiver[header.sessionId]) return false;

        if (this.blackList[peerIdString]) {
            const remainingMinutes = Math.floor(
                NETWORK_API_BLACK_LIST_TIME_WINDOW_MINUTES -
                    (Date.now() - this.blackList[peerIdString]) / (1000 * 60),
            );

            if (remainingMinutes > 0) {
                this.logger.debug(
                    `Blocking request from ${peerIdString}. Node is blacklisted for ${remainingMinutes} minutes.`,
                );

                return true;
            }
            delete this.blackList[peerIdString];
        }

        if (await this.rateLimiter.spamDetection.limit(peerIdString)) {
            this.blackList[peerIdString] = Date.now();
            this.logger.debug(
                `Blocking request from ${peerIdString}. Spammer detected and blacklisted for ${NETWORK_API_BLACK_LIST_TIME_WINDOW_MINUTES} minutes.`,
            );

            return true;
        }
        if (await this.rateLimiter.basicRateLimiter.limit(peerIdString)) {
            this.logger.debug(
                `Blocking request from ${peerIdString}. Max number of requests exceeded.`,
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

    async findPeer(peerIdString) {
        return this.node.peerRouting.findPeer(peerIdFromString(peerIdString));
    }

    async dial(peerIdString) {
        return this.node.dial(peerIdFromString(peerIdString));
    }

    async getPeerInfo(peerIdString) {
        return this.node.peerStore.get(peerIdFromString(peerIdString));
    }

    removeCachedSession(operationId, keywordUuid, peerIdString) {
        if (this.sessions[peerIdString]?.[operationId]?.[keywordUuid]?.stream) {
            this.sessions[peerIdString][operationId][keywordUuid].stream.close();
            delete this.sessions[peerIdString][operationId];
            this.logger.trace(
                `Removed session for remotePeerId: ${peerIdString}, operationId: ${operationId}.`,
            );
        }
    }
}

export default Libp2pService;
