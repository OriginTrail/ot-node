const Libp2p = require('libp2p');
const {Record} = require('libp2p-record');
const KadDHT = require('libp2p-kad-dht');
const Bootstrap = require('libp2p-bootstrap');
const {NOISE} = require('libp2p-noise');
const MPLEX = require('libp2p-mplex');
const TCP = require('libp2p-tcp');
const pipe = require('it-pipe');
const {sha256} = require('multiformats/hashes/sha2');
const {v1: uuidv1} = require("uuid");
const PeerId = require("peer-id");
const fs = require('fs');
const {time} = require("streaming-iterables");
const { BufferList } = require('bl')
const constants = require('../modules/constants');



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

            if (!this.config.peerId) {
                const configFile = JSON.parse(fs.readFileSync(this.config.configFilename));
                if (!configFile.network.privateKey) {
                    const id = await PeerId.create({bits: 1024, keyType: 'RSA'})
                    configFile.network.privateKey = id.toJSON().privKey;
                    if(process.env.NODE_ENV !== 'development') {
                        fs.writeFileSync(this.config.configFilename, JSON.stringify(configFile, null, 2));
                    }
                }
                this.config.privateKey = configFile.network.privateKey;
                this.config.peerId = await PeerId.createFromPrivKey(this.config.privateKey);
            }

            initializationObject.peerId = this.config.peerId;
            this.workerPool = this.config.workerPool;

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
                    resolve(result);
                })
                .catch((err) => {
                    reject(err);
                });
        });
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

    async findNodes(key, limit) {
        const encodedKey = new TextEncoder().encode(key);
        // Creates a DHT ID by hashing a given Uint8Array
        const id = (await sha256.digest(encodedKey)).digest;
        const nodes = this.node._dht.peerRouting.getClosestPeers(id);
        const result = [];
        for await (const node of nodes) {
            result.push(node);
        }
        this.logger.info(`Found ${result.length} nodes`);

        return result;
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

    async handleMessage(eventName, handler, options) {
        this.logger.info(`Enabling network protocol: ${eventName}`);

        let async = false, timeout = 60e3;
        if (options) {
            async = options.async;
            timeout = options.timeout;
        }
        this.node.handle(eventName, async (handlerProps) => {
            const {stream} = handlerProps;
            let timestamp = Date.now();

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
                this.logger.info(`Receiving message from ${handlerProps.connection.remotePeer._idB58String} to ${this.config.id}: event=${eventName};`);
                if (!async) {
                    const result = await handler(data);
                    this.logger.info(`Sending response from ${this.config.id} to ${handlerProps.connection.remotePeer._idB58String}: event=${eventName};`);
                    const stringifiedData = await this.workerPool.exec('JSONStringify', [result]);
                    await pipe(
                        [Buffer.from(stringifiedData)],
                        stream,
                    )
                } else {
                    await pipe(
                        [constants.NETWORK_RESPONSES.ACK],
                        stream
                    )

                    this.logger.info(`Sending response from ${this.config.id} to ${handlerProps.connection.remotePeer._idB58String}: event=${eventName};`);
                    const result = await handler(data);
                    if (Date.now() <= timestamp + timeout) {
                        await this.sendMessage(`${eventName}/result`, result, handlerProps.connection.remotePeer);
                    } else {
                        this.logger.warn(`Too late to send response from ${this.config.id} to ${handlerProps.connection.remotePeer._idB58String}: event=${eventName};`);
                    }
                }
            } catch (e) {
                const stringifiedData = await this.workerPool.exec('JSONStringify', [data]);
                this.logger.error({
                   msg: `Error: ${e}, stack: ${e.stack} \n Data received: ${stringifiedData}`,
                   Event_name: constants.ERROR_TYPE.LIBP2P_HANDLE_MSG_ERROR,
                });
                await pipe(
                    [constants.NETWORK_RESPONSES.ACK],
                    stream
                )

            }
        });
    }

    async sendMessage(eventName, data, peerId) {
        this.logger.info(`Sending message from ${this.config.id} to ${peerId._idB58String}: event=${eventName};`);
        const {stream} = await this.node.dialProtocol(peerId, eventName);
        const stringifiedData = await this.workerPool.exec('JSONStringify', [data]);
        const response = await pipe(
            [Buffer.from(stringifiedData)],
            stream,
            async function (source) {
                const bl = new BufferList()
                for await (const msg of source) {
                    bl.append(msg);
                }
                // console.log(`Receiving data using stream: ${result.toString()}`);
                return bl;
            },
        )

        if(response.toString() === constants.NETWORK_RESPONSES.ACK) {
            return null;
        }

        return JSON.parse(response);
    }

    healthCheck() {
        // TODO: broadcast ping or sent msg to yourself
        const connectedNodes = this.node.connectionManager.size;
        if (connectedNodes > 0) return true;
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
