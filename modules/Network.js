// start(...)
// connectToSeed(...)
// sendBroadcast(...)
// sendDirectMessage(...)
// onDirectMessage(...)
// broadcastMessage(...)
// onBroadcastMessage(...)

const crypto = require('crypto');
const bunyan = require('bunyan');
const levelup = require('levelup');
const encoding = require('encoding-down');
const leveldown = require('leveldown');
const kadence = require('@kadenceproject/kadence');

// TODO: change it for sqlite
const storage = levelup(encoding(leveldown('kad-storage/storage.db')));
const logger = bunyan.createLogger({ name: 'OriginTrail node' });
const transport = new kadence.HTTPTransport();
const identity = kadence.utils.getRandomKeyBuffer();
const contact = { hostname: 'localhost', port: 1337 };

/**
 * DHT module (Kademlia)
 */

class Network {
    /**
     * Setup options and construct a node
     */
    constructor() {
        // Construct a kademlia node interface; the returned `Node` object exposes:
        this.node = new kadence.KademliaNode({
            transport,
            storage,
            logger,
            identity,
            contact,
        });

        this.node.plugin(kadence.quasar());
    }

    start() {
        this.node.listen(1337);

        this.node.join(['ea48d3f07a5241291ed0b4cab6483fa8b8fcc123', {
            hostname: 'localhost',
            port: 8080,
        }], () => {
            // Add 'join' callback which indicates peers were discovered and
            // our node is now connected to the overlay network
            logger.info(`Connected to ${this.node.router.length} peers!`);

            // Base protocol exposes:
            // * node.iterativeFindNode(key, callback)
            // * node.iterativeFindValue(key, callback)
            // * node.iterativeStore(key, value, callback)
            //
            // Quasar plugin exposes:
            // * node.quasarPublish(topic, content)
            // * node.quasarSubscribe(topic, handler)
            // * node.quasarUpdate(callback)
            //
            // Example plugin exposes:
            // * node.sendNeighborEcho(text, callback)
        });
    }
}


module.exports = Network;
