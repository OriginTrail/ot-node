/* eslint-disable import/no-unresolved */
import { tcp } from '@libp2p/tcp';
import { mplex } from '@libp2p/mplex';
import { noise } from '@chainsafe/libp2p-noise';
import { bootstrap } from '@libp2p/bootstrap';
import { kadDHT } from '@libp2p/kad-dht';
import { peerIdFromString } from '@libp2p/peer-id';
import { createLibp2p } from 'libp2p';
import { identifyService } from 'libp2p/identify';
import { autoNATService } from 'libp2p/autonat';
import { uPnPNATService } from 'libp2p/upnp-nat';
import { pipe } from 'it-pipe';
import map from 'it-map';
import { encode, decode } from 'it-length-prefixed';
import { fromString as uint8ArrayFromString, toString as uint8ArrayToString } from 'uint8arrays';
import toobusy from 'toobusy-js';
import ip from 'ip';
import RateLimiter from './rate-limiter.js';
import SessionManager from './session-manager.js';
import { NETWORK_MESSAGE_TYPES } from '../../../constants/constants.js';
import KeyManager from './key-manager.js';
import MessageManager from './message-manager.js';

class Libp2pService {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;

        this.rateLimiter = new RateLimiter(logger);
        this.sessionManager = new SessionManager(logger);
        this.keyManager = new KeyManager(config);
        this.messageManager = new MessageManager();

        await this.initializeLibp2pNode();

        const port = parseInt(this.getMultiaddrs().toString().split('/')[4], 10);
        this.peerIdString = this.node.peerId.toString();
        this.logger.info(`Network ID is ${this.peerIdString}, connection port is ${port}`);
    }

    async initializeLibp2pNode() {
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
                    timeout: 10_000,
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
            peerId: await this.keyManager.getPeerId(),
            start: true,
        });
    }

    async onPeerConnected(listener) {
        this.node.addEventListener('peer:connect', listener);
    }

    getMultiaddrs() {
        return this.node.getMultiaddrs();
    }

    getPeerId() {
        return this.node.peerId;
    }

    getPeerIdString() {
        return this.peerIdString;
    }

    handleMessageRequest(protocol, handler) {
        this.logger.info(`Enabling network protocol: ${protocol}`);

        this.node.handle(protocol, async (handlerProps) => {
            const { stream } = handlerProps;
            const peerIdString = handlerProps.connection.remotePeer.toString();

            let message;
            try {
                message = await this._readMessageFromStream(stream, peerIdString, true);
            } catch (error) {
                let response;
                switch (error.message) {
                    case 'Busy':
                        response = NETWORK_MESSAGE_TYPES.RESPONSES.BUSY;
                        break;
                    case 'Invalid header':
                    case 'Invalid request':
                    default:
                        response = NETWORK_MESSAGE_TYPES.RESPONSES.NACK;
                }

                await this.sendMessageResponse(
                    protocol,
                    peerIdString,
                    response,
                    message?.header.operationId,
                    message?.header.keywordUuid,
                    { errorMessage: error.message },
                );
                return;
            }

            this.sessionManager.updateSessionStream(
                message.header.operationId,
                message.header.keywordUuid,
                peerIdString,
                stream,
            );

            this.logger.debug(
                `Receiving message from ${peerIdString} to ${this.peerIdString}: protocol: ${protocol}, messageType: ${message.header.messageType};`,
            );

            await handler(message, peerIdString);
        });
    }

    async getPublicIp(peerIdObject) {
        return ((await this.node.peerStore.get(peerIdObject)).addresses ?? [])
            .map((addr) => addr.multiaddr)
            .filter((addr) => addr.isThinWaistAddress())
            .map((addr) => addr.toString().split('/'))
            .filter((splittedAddr) => !ip.isPrivate(splittedAddr[2]))[0]?.[2];
    }

    async sendMessage(
        protocol,
        peerIdString,
        messageType,
        operationId,
        keywordUuid,
        messageData,
        timeout,
    ) {
        const peerIdObject = peerIdFromString(peerIdString);
        const publicIp = await this.getPublicIp(peerIdObject);

        const sendMessageInfo = `peer: ${peerIdString}, protocol: ${protocol}, messageType: ${messageType} , operationId: ${operationId}, public ip: ${publicIp}`;

        this.logger.trace(`Dialing ${sendMessageInfo}`);
        let stream;
        const dialStart = Date.now();
        try {
            stream = await this.node.dialProtocol(peerIdObject, protocol);
        } catch (error) {
            return this.messageManager.createMessage(
                NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                operationId,
                keywordUuid,
                {},
                `Unable to dial ${sendMessageInfo}, dial execution time: ${
                    Date.now() - dialStart
                } ms. Error: ${error.message}`,
            );
        }
        this.logger.trace(
            `Created stream for ${sendMessageInfo}, dial execution time: ${
                Date.now() - dialStart
            } ms.`,
        );

        this.sessionManager.updateSessionStream(operationId, keywordUuid, peerIdString, stream);

        const request = this.messageManager.createMessage(
            messageType,
            operationId,
            keywordUuid,
            messageData,
        );

        this.logger.trace(`Sending message to ${sendMessageInfo}`);

        const sendMessageStart = Date.now();
        try {
            await this._sendMessageToStream(stream, request);
        } catch (error) {
            return this.messageManager.createMessage(
                NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                operationId,
                keywordUuid,
                {},
                `Unable to send message to ${sendMessageInfo}, execution time: ${
                    Date.now() - sendMessageStart
                } ms. Error: ${error.message}`,
            );
        }

        let response;
        const timeoutSignal = AbortSignal.timeout(timeout);
        const onAbort = async () => {
            stream.abort();
            response = null;
        };
        const readResponseStart = Date.now();
        try {
            timeoutSignal.addEventListener('abort', onAbort, { once: true });

            response = await this._readMessageFromStream(stream, peerIdString);

            timeoutSignal.removeEventListener('abort', onAbort);

            if (timeoutSignal.aborted) {
                throw Error('Message timed out!');
            }
        } catch (error) {
            timeoutSignal.removeEventListener('abort', onAbort);

            return this.messageManager.createMessage(
                NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                operationId,
                keywordUuid,
                {},
                `Unable to read response from ${sendMessageInfo}, execution time: ${
                    Date.now() - readResponseStart
                } ms. Error: ${error.message}`,
            );
        }

        this.logger.trace(
            `Receiving response from ${peerIdString}. protocol: ${protocol}, messageType: ${
                response?.header?.messageType
            }, operationId: ${operationId}, execution time: ${Date.now() - readResponseStart} ms.`,
        );

        return response;
    }

    async sendMessageResponse(
        protocol,
        peerIdString,
        messageType,
        operationId,
        keywordUuid,
        messageData,
    ) {
        this.logger.debug(
            `Sending response from ${this.peerIdString} to ${peerIdString}: protocol: ${protocol}, messageType: ${messageType};`,
        );
        const stream = this.sessionManager.getSessionStream(operationId, keywordUuid, peerIdString);

        if (!stream) {
            throw Error(`Unable to find opened stream for remotePeerId: ${peerIdString}`);
        }

        const response = this.messageManager.createMessage(
            messageType,
            operationId,
            keywordUuid,
            messageData,
        );

        await this._sendMessageToStream(stream, response);
    }

    async _sendMessageToStream(stream, message) {
        await pipe(
            this.messageManager.messageToChunks(message),
            // turn strings into buffers
            (source) => map(source, (string) => uint8ArrayFromString(string)),
            // Encode with length prefix (so receiving side knows how much data is coming)
            (source) => encode(source),
            // Write to the stream (the sink)
            stream.sink,
        );
    }

    async _readMessageFromStream(stream, peerIdString, isRequest) {
        return pipe(
            // Read from the stream (the source)
            stream.source,
            // Decode length-prefixed data
            (source) => decode(source),
            // Turn buffers into strings
            (source) => map(source, (buf) => uint8ArrayToString(buf.subarray())),
            // Sink function
            async (source) => {
                const header = await this.readHeader(source, peerIdString, isRequest);
                const data = await this.readMessageData(source);
                return { header, data };
            },
        );
    }

    async readHeader(source, peerIdString, isRequest) {
        const stringifiedHeader = (await source.next()).value;

        if (!stringifiedHeader?.length) {
            throw new Error('Invalid header');
        }

        const header = JSON.parse(stringifiedHeader);

        await this.validateHeader(header, peerIdString, isRequest);

        return header;
    }

    async readMessageData(source) {
        let stringifiedData = '';
        for await (const chunk of source) {
            stringifiedData += chunk;
        }
        return JSON.parse(stringifiedData);
    }

    async validateHeader(header, peerIdString, isRequest) {
        if (isRequest) {
            if (!(await this.isRequestValid(header, peerIdString))) {
                throw new Error('Invalid request');
            }
            if (
                header.messageType === NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT &&
                this.isBusy()
            ) {
                throw new Error('Busy');
            }
        } else if (!this.messageManager.isResponseValid(header)) {
            throw new Error('Invalid response');
        }
    }

    async isRequestValid(header, peerIdString) {
        if (
            (await this.rateLimiter.limitRequest(peerIdString)) ||
            !this.messageManager.isRequestValid(header)
        )
            return false;

        if (header.messageType === NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT) {
            return true;
        }

        return this.sessionManager.sessionExists(
            peerIdString,
            header.operationId,
            header.keywordUuid,
        );
    }

    healthCheck() {
        // TODO: broadcast ping or sent msg to yourself
        const connections = this.node.getConnections().length;
        return connections > 0;
    }

    isBusy() {
        return toobusy();
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
