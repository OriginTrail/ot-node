/**
 * @module kadence/contentaddress
 */

'use strict';

const { createHash } = require('crypto');
const merge = require('merge');
const assert = require('assert');


/**
 * Enforces that any {@link KademliaNode~entry} stored in the DHT must be
 * content-addressable (keyed by the hash of it's value).
 */
class ContentAddressPlugin {

  static get DEFAULTS() {
    return {
      keyAlgorithm: 'rmd160',
      valueEncoding: 'base64'
    };
  }

  /**
   * @constructor
   * @param {AbstractNode} node
   * @param {object} [options]
   * @param {string} [options.keyAlgorithm="rmd160"] - Algorithm for hashing
   * @param {string} [options.valueEncoding="base64"] - Text encoding of value
   */
  constructor(node, options) {
    this.node = node;
    this.opts = merge(ContentAddressPlugin.DEFAULTS, options);

    this.node.use('STORE', (req, res, next) => this.validate(req, res, next));
  }

  /**
   * Validate the the key matches the hash of the value
   * @param {AbstractNode~request} request
   * @param {AbstractNode~response} response
   * @param {AbstractNode~next} next
   */
  validate(request, response, next) {
    let buffer, hash, [key, item] = request.params;

    try {
      buffer = Buffer.from(item.value, this.opts.valueEncoding);
      hash = createHash(this.opts.keyAlgorithm).update(buffer).digest('hex');

      assert(key === hash);
    } catch (err) {
      return next(new Error('Item failed validation check'));
    }

    next();
  }

}

/**
 * Registers a {@link module:kadence/contentaddress~ContentAddressPlugin} with
 * a {@link KademliaNode}
 * @param {object} [options]
 * @param {string} [options.keyAlgorithm="rmd160"] - Algorithm for hashing
 * @param {string} [options.valueEncoding="base64"] - Text encoding of value
 */
module.exports = function(options) {
  return function(node) {
    return new ContentAddressPlugin(node, options);
  }
};

module.exports.ContentAddressPlugin = ContentAddressPlugin;
