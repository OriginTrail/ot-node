/**
 * @module kadence/eclipse
 */

'use strict';

const assert = require('assert');
const hdkey = require('hdkey');
const utils = require('./utils');
const constants = require('./constants');
const { EventEmitter } = require('events');
const async = require('async');


/**
 * Generates an indentity for use with the
 * {@link module:kadence/spartacus~SpartacusPlugin} that satisfies a proof of
 * work
 */
class EclipseIdentity extends EventEmitter {

  /**
   * @constructor
   * @param {string} xprv - Private extended key
   * @param {number} [index=0] - Derivation index
   */
  constructor(xprv, index = 0) {
    super();

    this.xprv = xprv;
    this.index = index;
  }

  /**
   * Finds the correct derivation index
   * @returns {number}
   */
  solve() {
    return new Promise((resolve, reject) => {
      async.until(() => this.validate(), (done) => {
        this.index++;
        this.emit('index', this.index);

        /* istanbul ignore if */
        if (this.index > constants.MAX_NODE_INDEX) {
          return done(new Error('Derivation indexes exhausted'));
        }

        setImmediate(done);
      }, err => {
        /* istanbul ignore if */
        if (err) {
          reject(err);
        } else {
          resolve(this.index);
        }
      });
    });
  }

  /**
   * Validates the given extended private key and index
   * @returns {boolean}
   */
  validate() {
    const parent = hdkey.fromExtendedKey(this.xprv)
      .derive(constants.HD_KEY_DERIVATION_PATH);
    const child = parent.deriveChild(this.index);
    const result = utils.scrypt(child.publicKey);

    return utils.satisfiesDifficulty(result, constants.IDENTITY_DIFFICULTY);
  }

}


/**
 * Enforces identities that satisfy a proof of work
 */
class EclipseRules {

  /**
   * @constructor
   * @param {Node} node
   */
  constructor(node) {
    this.node = node;
  }

  /**
   * Validates all incoming RPC messages
   * @param {AbstractNode~request} request
   * @param {AbstractNode~response} response
   */
  validate(request, response, next) {
    const publicKey = hdkey.fromExtendedKey(request.contact[1].xpub)
      .derive(constants.HD_KEY_DERIVATION_PATH)
      .deriveChild(request.contact[1].index).publicKey;

    try {
      assert(utils.isCompatibleVersion(request.contact[1].agent),
        `Unsupported protocol version ${request.contact[1].agent}`);
      assert(utils.satisfiesDifficulty(
        utils.scrypt(publicKey),
        constants.IDENTITY_DIFFICULTY
      ), 'Identity key does not satisfy the network difficulty');
    } catch (err) {
      return next(err);
    }

    return next();
  }

}

/**
 * Enforces proof of work difficulty for entering the routing table and ensures
 * a high degree of randomness in resulting node identity
 */
class EclipsePlugin {

  /**
   * @constructor
   * @param {KademliaNode} node
   */
  constructor(node) {
    this.node = node;
    this.rules = new EclipseRules(this.node);

    this.node.use(this.rules.validate.bind(this.rules));
  }

}

/**
 * Registers a {@link module:kadence/eclipse~EclipsePlugin} with a
 * {@link KademliaNode}
 */
module.exports = function() {
  return function(node) {
    return new EclipsePlugin(node);
  }
};

module.exports.EclipsePlugin = EclipsePlugin;
module.exports.EclipseRules = EclipseRules;
module.exports.EclipseIdentity = EclipseIdentity;
