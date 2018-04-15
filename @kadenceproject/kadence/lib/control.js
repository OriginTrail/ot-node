'use strict';

const constants = require('../lib/constants');
const version = require('../lib/version');
const { PermissionSolution: Solution } = require('../lib/plugin-permission');
const secp256k1 = require('secp256k1');


/**
 * The Kadence daemon can be controlled by another process on the same host or
 * remotely via socket connection. By default, the daemon is configured to
 * listen on a UNIX domain socket located at $HOME/.config/kadence/kadence.sock.
 * Once connected to the daemon, you may send it control commands to build
 * networks in other languages. The controller understands newline terminated
 * JSON-RPC 2.0 payloads.
 */
class Control {

  /**
   * @constructor
   * @param {KademliaNode} node
   */
  constructor(node) {
    this.node = node;
  }

  /**
   * @private
   */
  _parseMethodSignature(name) {
    const method = name;
    const func = this[method].toString();
    const args = func.split(`${method}(`)[1].split(')')[0];
    const params = args.split(', ').map(s => s.trim());

    params.pop();

    return { method, params };
  }

  /**
   * Returns a list of the support methods from the controller
   * @param {Control~listMethodsCallback} callback
   */
  listMethods(callback) {
    callback(null, Object.getOwnPropertyNames(Object.getPrototypeOf(this))
      .filter(method => {
        return method[0] !== '_' && method !== 'constructor' &&
          typeof this[method] === 'function';
      })
      .map(this._parseMethodSignature.bind(this))
      .sort((a, b) => b.method < a.method));
  }
  /**
   * @callback Control~listMethodsCallback
   * @param {error|null} error
   * @param {object[]} methods
   * @param {string} methods.method
   * @param {string[]} methods.params
   */

  /**
   * Returns basic informations about the running node
   * @param {Control~getProtocolInfoCallback} callback
   */
  getProtocolInfo(callback) {
    const peers = [], dump = this.node.router.getClosestContactsToKey(
      this.node.identity,
      constants.K * constants.B
    );

    for (let peer of dump) {
      peers.push(peer);
    }

    callback(null, {
      versions: version,
      identity: this.node.identity.toString('hex'),
      contact: this.node.contact,
      peers
    });
  }
  /**
   * @callback Control~getProtocolInfoCallback
   * @param {error|null} error
   * @param {object} info
   * @param {object} info.versions
   * @param {string} info.versions.software
   * @param {string} info.versions.protocol
   * @param {string} info.identity
   * @param {object} info.contact
   * @param {array[]} info.peers
   */

  /**
   * Returns the local wallet balance
   * @param {Control~getWalletBalanceCallback}
   */
  getWalletBalance(callback) {
    callback(null, { total: this.node.wallet.balance });
  }
  /**
   * @callback Control~getWalletBalanceCallback
   * @param {error|null} error
   * @param {object} balances
   * @param {number} balances.total
   */

  /**
   * Returns the complete list of solution keys
   * @param {Control~getWalletSolutionKeysCallback} callback
   */
  getWalletSolutionKeys(callback) {
    callback(null, this.node.wallet.solutions);
  }
  /**
   * @callback Control~getWalletSolutionKeysCallback
   * @param {error|null}
   * @param {string[]} solutionsKeys
   */

  /**
   * Loads the local solution by it's key
   * @param {string} hexSolutionKey
   * @param {Control~getWalletSolutionCallback} callback
   */
  getWalletSolution(hexSolutionKey, callback) {
    const sol = this.node.wallet.get(hexSolutionKey)
      .toBuffer().toString('hex');

    callback(null, sol);
  }
  /**
   * @callback Control~getWalletSolutionCallback
   * @param {error|null} error
   * @param {string} hexSolution
   */

  /**
   * Inserts the solution into the wallet - overwriting existing versions of
   * the same key
   * @param {string} hexSolution
   * @param {Control~putWalletSolutionCallback} callback
   */
  putWalletSolution(hexSolution, callback) {
    this.node.wallet.put(new Solution(Buffer.from(hexSolution, 'hex')));
    callback(null);
  }
  /**
   * @callback Control~putWalletSolutionCallback
   * @param {error|null} error
   */

  /**
   * Transfers ownership of the solution to the supplied public key
   * @param {string} hexSolutionKey
   * @param {string} hexPublickey
   * @param {Control~transferWalletSolutionCallback} callback
   */
  transferWalletSolution(hexSolutionKey, publicKey, callback) {
    const sol = this.node.wallet.transfer(hexSolutionKey,
      Buffer.from(publicKey, 'hex'));
    this.node.wallet.put(sol);
    callback(null);
  }
  /**
   * @callback Control~transferWalletSolutionCallback
   * @param {error|null} error
   */

  /**
   * {@link KademliaNode#ping}
   */
  /* istanbul ignore next */
  ping(contact, callback) {
    this.node.ping(contact, callback);
  }

  /**
   * {@link KademliaNode#iterativeFindNode}
   */
  /* istanbul ignore next */
  iterativeFindNode(hexKey, callback) {
    this.node.iterativeFindNode(hexKey, callback);
  }

  /**
   * {@link KademliaNode#iterativeFindValue}
   */
  /* istanbul ignore next */
  iterativeFindValue(hexSolutionKey, callback) {
    this.node.iterativeFindValue(hexSolutionKey, callback);
  }

  /**
   * {@link KademliaNode#iterativeStore}
   */
  /* istanbul ignore next */
  iterativeStore(hexSolutionKey, hexMemoValue, callback) {
    this.node.iterativeStore(this.node.wallet.get(hexSolutionKey),
      Buffer.from(hexMemoValue, 'hex'), callback);
  }

  /**
   * {@link module:kadence/quasar~QuasarPlugin#quasarSubscribe}
   */
  /* istanbul ignore next */
  quasarSubscribe(hexKey, callback) {
    this.node.quasarSubscribe(hexKey, callback);
  }

  /**
   * {@link module:kadence/quasar~QuasarPlugin#quasarPublish}
   */
  /* istanbul ignore next */
  quasarPublish(hexKey, contentValue, callback) {
    this.node.quasarPublish(hexKey, contentValue, callback);
  }

  /**
   * Signs the given message with the wallet private key
   * @param {string} hexMessage
   * @param {Control~signMessageCallback} callback
   */
  signMessage(hexMessage, callback) {
    const result = secp256k1.sign(Buffer.from(hexMessage, 'hex'),
      this.node.wallet.privateKey);

    result.signature = result.signature.toString('hex');
    callback(null, result);
  }
  /**
   * @callback Control~signMessageCallback
   * @param {error|null} error
   * @param {object} result
   * @param {string} result.signature
   * @param {number} result.recovery
   */

  /**
   * Verifies the signature for the given message and public key
   * @param {string} hexMessage
   * @param {string} hexSignature
   * @param {string} hexPublickey
   * @param {Control~verifyMessageCallback} callback
   */
  verifyMessage(hexMessage, hexSignature, hexPublicKey, callback) {
    const result = secp256k1.verify(
      Buffer.from(hexMessage, 'hex'),
      Buffer.from(hexSignature, 'hex'),
      Buffer.from(hexPublicKey, 'hex')
    );

    callback(null, result);
  }
  /**
   * @callback Control~verifyMessageCallback
   * @param {error|null} error
   * @param {boolean} valid
   */

}

module.exports = Control;
