const Datastore = require('nedb');
const KadenceUtils = require('@kadenceproject/kadence/lib/utils.js');

/**
 * Keeps track of seen contacts in a compact file so they can be used as
 * bootstrap nodes
 */
class PeerCache {
    constructor(node, peerCacheFilePath) {
        this.node = node;
        this.db = new Datastore({ filename: peerCacheFilePath, autoload: true });
        this.db.persistence.setAutocompactionInterval(10000);

        this.node.router.events.on('add', (identity) => {
            this.node.logger.debug(`updating peer profile ${identity}`);
            const contact = this.node.router.getContactByNodeId(identity);
            if (contact != null) {
                contact.timestamp = Date.now();
                this._setExternalPeerInfo(identity, contact);
            }
        });
    }

    /**
     * Gets the external peer data for the given identity
     * @param {string} identity - Identity key for the peer
     * @returns {object}
     */
    getExternalPeerInfo(identity) {
        return new Promise((resolve, reject) => {
            this.db.findOne({ _id: identity }, (err, doc) => {
                if (err) {
                    reject(err);
                } else if (doc == null) {
                    resolve(null);
                } else {
                    resolve(KadenceUtils.getContactURL([
                        doc._id,
                        doc.contact,
                    ]));
                }
            });
        });
    }

    /**
     * Sets the external peer data for the given identity
     * @param {string} identity - Identity key for the peer
     * @param {object} contact - Peer's external contact information
     * @returns {object}
     */
    _setExternalPeerInfo(identity, contact) {
        return new Promise((resolve, reject) => {
            this.db.update(
                {
                    _id: identity,
                },
                {
                    contact,
                    _id: identity,
                },
                {
                    upsert: true,
                },
                (err, newDoc) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(newDoc);
                    }
                },
            );
        });
    }

    /**
     * Returns a list of bootstrap nodes from local profiles
     * @returns {string[]} urls
     */
    getBootstrapCandidates() {
        return new Promise((resolve, reject) => {
            this.db.find({}, (err, docs) => {
                if (err) {
                    reject(err);
                } else {
                    docs.sort((d1, d2) => d2.contact.timestamp - d1.contact.timestamp);
                    resolve(docs.map(doc => KadenceUtils.getContactURL([
                        doc._id,
                        doc.contact,
                    ])));
                }
            });
        });
    }
}

/**
 * Registers a cache with a {@link KademliaNode}
 * @param {string} peerCacheFilePath - Path to file to use for storing peers
 */
module.exports = peerCacheFilePath => node => new PeerCache(node, peerCacheFilePath);

module.exports.PeerCache = PeerCache;
