/**
 * @module kadence/rolodex
 */

'use strict';

const utils = require('./utils');
const tiny = require('tiny');


/**
 * Keeps track of seen contacts in a compact file so they can be used as
 * bootstrap nodes
 */
class RolodexPlugin {

  static get EXTERNAL_PREFIX() {
    return 'external';
  }

  static get INTERNAL_PREFIX() {
    return 'internal';
  }

  /**
   * @constructor
   * @param {KademliaNode} node
   * @param {string} peerCacheFilePath - Path to file to use for storing peers
   */
  constructor(node, peerCacheFilePath) {
    this.node = node;
    this.db = tiny(peerCacheFilePath);

    this.node.router.events.on('add', identity => {
      this.node.logger.debug(`updating peer profile ${identity}`);
      const contact = this.node.router.getContactByNodeId(identity);
      contact.timestamp = Date.now();
      this.setExternalPeerInfo(identity, contact);
    });
  }

  /**
   * Returns a list of bootstrap nodes from local profiles
   * @returns {string[]} urls
   */
  getBootstrapCandidates() {
    const candidates = [];
    return new Promise(resolve => {
      this.db.each((contact, key) => {
        const [prefix, identity] = key.split(':');

        /* istanbul ignore else */
        if (prefix === RolodexPlugin.EXTERNAL_PREFIX) {
          candidates.push([identity, contact]);
        }
      });
      resolve(candidates.sort((a, b) => b[1].timestamp - a[1].timestamp)
        .map(utils.getContactURL));
    });
  }

  /**
   * Returns the external peer data for the given identity
   * @param {string} identity - Identity key for the peer
   * @returns {object}
   */
  getExternalPeerInfo(identity) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `${RolodexPlugin.EXTERNAL_PREFIX}:${identity}`,
        (err, data) => {
          /* istanbul ignore if */
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        }
      );
    });
  }

  /**
   * Returns the internal peer data for the given identity
   * @param {string} identity - Identity key for the peer
   * @returns {object}
   */
  getInternalPeerInfo(identity) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `${RolodexPlugin.INTERNAL_PREFIX}:${identity}`,
        (err, data) => {
          /* istanbul ignore if */
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        }
      );
    });
  }

  /**
   * Returns the external peer data for the given identity
   * @param {string} identity - Identity key for the peer
   * @param {object} data - Peer's external contact information
   * @returns {object}
   */
  setExternalPeerInfo(identity, data) {
    return new Promise((resolve, reject) => {
      this.db.set(
        `${RolodexPlugin.EXTERNAL_PREFIX}:${identity}`,
        data,
        (err, data) => {
          /* istanbul ignore if */
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        }
      );
    });
  }

  /**
   * Returns the internal peer data for the given identity
   * @param {string} identity - Identity key for the peer
   * @param {object} data - Our own internal peer information
   * @returns {object}
   */
  setInternalPeerInfo(identity, data) {
    return new Promise((resolve, reject) => {
      this.db.set(
        `${RolodexPlugin.INTERNAL_PREFIX}:${identity}`,
        data,
        (err, data) => {
          /* istanbul ignore if */
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        }
      );
    });
  }

}

/**
 * Registers a {@link module:kadence/rolodex~RolodexPlugin} with a
 * {@link KademliaNode}
 * @param {string} peerCacheFilePath - Path to file to use for storing peers
 */
module.exports = function(peerCacheFilePath) {
  return function(node) {
    return new RolodexPlugin(node, peerCacheFilePath);
  }
};

module.exports.RolodexPlugin = RolodexPlugin;
