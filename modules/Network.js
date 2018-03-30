// start(...)
// connectToSeed(...)
// sendBroadcast(...)
// sendDirectMessage(...)
// onDirectMessage(...)
// broadcastMessage(...)
// onBroadcastMessage(...)

const { EventEmitter } = require('events');
const crypto = require('crypto');
const log = require('./utilities').getLogger();
const levelup = require('levelup');
const encoding = require('encoding-down');
const leveldown = require('leveldown');
const kadence = require('@kadenceproject/kadence');
const fs = require('fs');

const utilities = require('./utilities');

// TODO: change it for sqlite
const storage = levelup(encoding(leveldown('kad-storage/storage.db')));
const transport = new kadence.HTTPTransport();

/**
 * DHT module (Kademlia)
 */

class Network {
    /**
   * Setup options and construct a node
   */
    constructor(config) {
        this.config = config;

        this.index = parseInt(config.child_derivation_index, 10);

        // Initialize private extended key
        utilities.createPrivateExtendedKey(config, kadence);

        // Initialize public contact data
        const contact = {
            hostname: config.node_rpc_ip,
            protocol: 'http:',
            port: parseInt(config.node_rpc_port, 10),
            // xpub: parentkey.publicExtendedKey,
            index: parseInt(config.ChildDerivationIndex, 10),
            agent: kadence.version.protocol,
        };

        // Construct a kademlia node interface; the returned `Node` object exposes:
        this.createIdentity().then((identity) => {
            this.node = new kadence.KademliaNode({
                transport,
                storage,
                log,
                identity,
                contact,
            });
        }).catch((e) => {

        });

        this.node.plugin(kadence.quasar());
    }


    async selfSignedCertificate() {
        if (!fs.existsSync(`../keys/${this.config.ssl_key_path}`)) {
            await utilities.generateSelfSignedCertificate(this.config);
        }
    }

    createIdentity() {

    }

    spawnDerivationProcesses(xprivkey, events) {
        const cpus = parseInt(this.config.cpus);

        if (cpus === 0) {
            return logger.info('there are no derivation processes running');
        }

        if (os.cpus().length < cpus) {
            return logger.error('refusing to start more solvers than cpu cores');
        }

        for (let c = 0; c < cpus; c++) {
            const index = Math.floor(kadence.constants.MAX_NODE_INDEX / cpus) * c;
            const solver = forkDerivationSolver(c, xprivkey, index, events);

            solvers.push(solver);
            solver.once('exit', (code) => {
                if (code === 0) {
                    logger.info(`derivation solver ${c} exited normally`);
                } else {
                    logger.error(`derivation solver ${c} exited with code ${code}`);
                }
            });
        }

        return new Promise((resolve, reject) => {
            events.once('index', (i) => {
                events.removeAllListeners();
                solvers.forEach(s => s.kill('SIGTERM'));
                resolve(i);
            });
        });
    }

    start() {
        this.selfSignedCertificate();
        xprivkey = fs.readFileSync(config.PrivateExtendedKeyPath).toString();
        identity = new kadence.eclipse.EclipseIdentity(xprivkey, index);


        this.node.listen(this.config.node_rpc_port);
        log.info(`Listening on port ${this.config.node_rpc_port}`);


        this.node.join(['ea48d3f07a5241291ed0b4cab6483fa8b8fcc123', {
            hostname: 'localhost',
            port: this.config.node_rpc_port,
        }], () => {
        // Add 'join' callback which indicates peers were discovered and
        // our node is now connected to the overlay network
            log.info(`Connected to ${this.node.router.length} peers!`);

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

