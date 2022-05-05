const Libp2p = require('libp2p');
const {Record} = require('libp2p-record');
const KadDHT = require('libp2p-kad-dht');
const Bootstrap = require('libp2p-bootstrap');
const {NOISE} = require('libp2p-noise');
const MPLEX = require('libp2p-mplex');
const TCP = require('libp2p-tcp');
const pipe = require('it-pipe');
const {sha256} = require('multiformats/hashes/sha2');
const PeerId = require("peer-id");
const { BufferList } = require('bl')
const { InMemoryRateLimiter } = require("rolling-rate-limiter");
const constants = require('../modules/constants');
 const { TimeoutController } = require('timeout-abort-controller');

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
    constructor(config) {
        this.config = config;
    }

    initialize(logger) {
        this.logger = logger;
        return new Promise(async (resolve, reject) => {
            if (this.config.bootstrapMultiAddress.length > 0) {
                initializationObject.modules.peerDiscovery = [Bootstrap];
                initializationObject.config.peerDiscovery = {
                    autoDial: true,
                    [Bootstrap.tag]: {
                        enabled: true,
                        list: this.config.bootstrapMultiAddress,
                    },
                };
            }
            initializationObject.addresses = {
                listen: [`/ip4/0.0.0.0/tcp/${this.config.port}`] // for production
                // announce: ['/dns4/auto-relay.libp2p.io/tcp/443/wss/p2p/QmWDn2LY8nannvSWJzruUYoLZ4vV83vfCBwd8DipvdgQc3']
            };
            let id;
            let privKey;
            if (!this.config.peerId) {
                if (!this.config.privateKey) {
                    id = await PeerId.create({bits: 1024, keyType: 'RSA'})
                    privKey = id.toJSON().privKey;
                } else {
                    privKey = this.config.privateKey;
                    id = await PeerId.createFromPrivKey(this.config.privateKey);
                }
                this.config.privateKey = privKey;
                this.config.peerId = id;
            }

            initializationObject.peerId = this.config.peerId;
            this.workerPool = this.config.workerPool;
            this._initializeRateLimiters();

            Libp2p.create(initializationObject).then((node) => {
                this.node = node;
                this._initializeNodeListeners();
            })
                .then(() => this.node.start())
                .then((result) => {
                    const port = parseInt(this.node.multiaddrs.toString().split('/')[4], 10);
                    const peerId = this.node.peerId._idB58String;
                    this.config.id = peerId;
                    this.logger.info(`Network ID is ${peerId}, connection port is ${port}`);
                    resolve({
                        peerId: this.config.peerId,
                        privateKey: this.config.privateKey,
                    });
                })
                .catch((err) => {
                    reject(err);
                });
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
        }

        this.blackList = {};
    }

    _initializeNodeListeners() {
        this.node.on('peer:discovery', (peer) => {
            this._onPeerDiscovery(peer);
        });
        this.node.connectionManager.on('peer:connect', (connection) => {
            this._onPeerConnect(connection);
        });
    }

    _onPeerDiscovery(peer) {
        this.logger.debug(`Node ${this.node.peerId._idB58String} discovered ${peer._idB58String}`);
    }

    _onPeerConnect(connection) {
        this.logger.debug(`Node ${this.node.peerId._idB58String} connected to ${connection.remotePeer.toB58String()}`);
    }

    async findNodes(key, protocol) {
        const encodedKey = new TextEncoder().encode(key);
        // Creates a DHT ID by hashing a given Uint8Array
        const id = (await sha256.digest(encodedKey)).digest;
        const nodes = this.node._dht.peerRouting.getClosestPeers(id);
        const result = new Set();
        for await (const node of nodes) {
            if(this.node.peerStore.peers.get(node._idB58String).protocols.includes(protocol)){
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

    async prepareForSending(data) {
        if(constants.NETWORK_RESPONSES[data]) {
            data = constants.STRINGIFIED_NETWORK_RESPONSES[data];
        } else {
            data = await this.workerPool.exec('JSONStringify', [data]);
        }
        return Buffer.from(data);
    }

    async handleMessage(eventName, handler, options) {
        this.logger.info(`Enabling network protocol: ${eventName}`);

        let async = false, timeout = constants.NETWORK_HANDLER_TIMEOUT;
        if (options) {
            async = options.async;
            timeout = options.timeout;
        }
        this.node.handle(eventName, async (handlerProps) => {
            const {stream} = handlerProps;
            let timestamp = Date.now();
            const remotePeerId = handlerProps.connection.remotePeer._idB58String;
            if(await this.limitRequest(remotePeerId)) {
                    const preparedBlockedResponse = await this.prepareForSending(constants.NETWORK_RESPONSES.BLOCKED);
                    await pipe(
                        [preparedBlockedResponse],
                        stream
                    );
                    return;
            }
            let data = await pipe(
                stream,
                async function (source) {
                    const bl = new BufferList()
                    for await (const msg of source) {
                        bl.append(msg);
                    }
                    // console.log(`Receiving data using stream: ${result.toString()}`);
                    return bl;
                }
            )
            try {
                data = await this.workerPool.exec('JSONParse', [data.toString()]);
                this.logger.info(`Receiving message from ${remotePeerId} to ${this.config.id}: event=${eventName};`);
                if (!async) {
                    const result = await handler(data);
                    this.logger.info(`Sending response from ${this.config.id} to ${remotePeerId}: event=${eventName};`);
                    const preparedData = await this.prepareForSending(result);
                    await pipe(
                        [Buffer.from(preparedData)],
                        stream,
                    )
                } else {
                    const preparedAckResponse = await this.prepareForSending(constants.NETWORK_RESPONSES.ACK);
                    await pipe(
                        [preparedAckResponse],
                        stream
                    )

                    this.logger.info(`Sending response from ${this.config.id} to ${remotePeerId}: event=${eventName};`);
                    const result = await handler(data);
                    if (Date.now() <= timestamp + timeout) {
                        await this.sendMessage(`${eventName}/result`, result, handlerProps.connection.remotePeer);
                    } else {
                        this.logger.warn(`Too late to send response from ${this.config.id} to ${remotePeerId}: event=${eventName};`);
                    }
                }
            } catch (e) {
                const stringifiedData = await this.workerPool.exec('JSONStringify', [data]);
                this.logger.error({
                   msg: `Error: ${e}, stack: ${e.stack} \n Data received: ${stringifiedData}`,
                   Event_name: constants.ERROR_TYPE.LIBP2P_HANDLE_MSG_ERROR,
                });
                const preparedErrorResponse = await this.prepareForSending(constants.NETWORK_RESPONSES.ERROR);
                await pipe(
                    [preparedErrorResponse],
                    stream
                );
            }
        });
    }

    async sendMessage(eventName, data, peerId, options = {}) {
        this.logger.info(`Sending message from ${this.config.id} to ${peerId._idB58String}: event=${eventName};`);
        const {stream} = await this.node.dialProtocol(peerId, eventName);
        const preparedData = await this.prepareForSending(data);

        let timeoutController;
        if (options.timeout) {
            timeoutController = new TimeoutController(options.timeout);
            timeoutController.signal.addEventListener(
                'abort',
                async () => {
                    stream.abort();
                },
                { once: true }
            );
        }

        const response = await pipe(
            [Buffer.from(preparedData)],
            stream,
            async function (source) {
                const bl = new BufferList()
                for await (const msg of source) {
                    bl.append(msg);
                }
                return bl;
            },
        )

        if(timeoutController) {
            timeoutController.signal.removeEventListener('abort');
            timeoutController.clear();
        }

        if(response.toString() === '') {
            return null;
        }

        const parsedData = await this.workerPool.exec('JSONParse', [response.toString()]);
        const suppressedResponses = [constants.NETWORK_RESPONSES.ACK, constants.NETWORK_RESPONSES.BLOCKED, constants.NETWORK_RESPONSES.ERROR];
        if(suppressedResponses.includes(parsedData)) {
            return null;
        }
        return parsedData;
    }

    healthCheck() {
        // TODO: broadcast ping or sent msg to yourself
        const connectedNodes = this.node.connectionManager.size;
        if (connectedNodes > 0) return true;
        return false;
    }

    async limitRequest(remotePeerId) {
        if(this.blackList[remotePeerId]){
            const remainingMinutes = Math.floor(
              constants.NETWORK_API_BLACK_LIST_TIME_WINDOW_MINUTES -
                (Date.now() - this.blackList[remotePeerId]) / (1000 * 60)
            );

            if(remainingMinutes > 0) {
                this.logger.info(`Blocking request from ${remotePeerId}. Node is blacklisted for ${remainingMinutes} minutes.`);

                return true;
            } else {
                delete this.blackList[remotePeerId]
            }
        }

        if(await this.rateLimiter.spamDetection.limit(remotePeerId)) {
            this.blackList[remotePeerId] = Date.now();
            this.logger.info(
                `Blocking request from ${remotePeerId}. Spammer detected and blacklisted for ${constants.NETWORK_API_BLACK_LIST_TIME_WINDOW_MINUTES} minutes.`
            );

            return true;
        } else if (await this.rateLimiter.basicRateLimiter.limit(remotePeerId)) {
            this.logger.info(`Blocking request from ${remotePeerId}. Max number of requests exceeded.`);

            return true;
        }

        return false;
    }

    async restartService() {
        this.logger.info('Restrating libp2p service...');
        // TODO: reinitialize service
    }

    getPrivateKey() {
        return this.node.peerId.privKey;
    }

    getName() {
        return 'Libp2p';
    }

}


module.exports = Libp2pService;
