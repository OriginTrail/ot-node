/**
 * @module kadence/hashcash
 */

'use strict';

const { Transform } = require('stream');
const async = require('async');
const merge = require('merge');
const jsonrpc = require('jsonrpc-lite');
const crypto = require('crypto');
const assert = require('assert');
const LRUCache = require('lru-cache');
const utils = require('./utils');


/**
 * Requires proof of work to process messages and performs said work before
 * issuing RPC messages to peers
 */
class HashCashPlugin {

  static get METHOD() {
    return 'HASHCASH';
  }

  static get DEFAULTS() {
    return {
      methods: [], // All methods by default
      difficulty: 8, // 8 leading zeroes
      timeframe: 172800000 // 2 day window
    };
  }

  /**
   * @constructor
   * @param {object} node
   * @param {object} [options]
   * @param {string[]} [options.methods=[]] - RPC methods to enforce hashcash
   * @param {number} [options.difficulty=8] - Leading zero bits in stamp
   * @param {number} [options.timeframe=172800000] - Timestamp valid window
   */
  constructor(node, options = {}) {
    this._opts = merge(HashCashPlugin.DEFAULTS, options);
    this._node = node;
    this._cache = new LRUCache(1000);

    this._node.rpc.deserializer.prepend(new Transform({
      transform: this.verify.bind(this),
      objectMode: true
    }));

    this._node.rpc.serializer.append(new Transform({
      transform: this.prove.bind(this),
      objectMode: true
    }));
  }

  /**
   * Verifies the proof of work on the request object
   * @implements {Messenger~deserializer}
   */
  verify(data, encoding, callback) {
    /* eslint max-statements: [2, 26] */
    let payload = jsonrpc.parse(data.toString('utf8')).map((obj) => {
      return obj.payload;
    });
    // console.log('Comes to verify: ');
    // console.log(payload);
    let verifyMessage = (this._opts.methods.includes(payload[0].method) ||
                        this._opts.methods.length === 0) &&
                        typeof payload[0].method !== 'undefined';
    // console.log("Verifies the proof of work on the request object " + verifyMessage);
    if (!verifyMessage) {
      return callback(null, data);
    }

    let proof = payload.filter(m => m.method === HashCashPlugin.METHOD).pop();
    let contact = payload.filter(m => m.method === 'IDENTIFY').pop();

    if (!proof) {
      return callback(new Error('HashCash stamp is missing from payload'));
    }

    let stamp = HashCashPlugin.parse(proof.params[0]);
    console.log('stamp');
    console.log(stamp);
    let sender = stamp.resource.substr(0, 40);
    console.log('sender')
    console.log(sender)
    let target = Buffer.from(stamp.resource.substr(40, 40), 'hex');
    let method = Buffer.from(
      stamp.resource.substr(80),
      'hex'
    ).toString('utf8');
    console.log('difficulty ' + this._opts.difficulty);
    try {
      assert(this._cache.get(stamp.toString()) !== 1, 'Cannot reuse proof');
      assert(stamp.bits === this._opts.difficulty, 'Invalid proof difficulty');
      assert(sender === contact.params[0], 'Invalid sender in proof');
      console.log(target);
      console.log(this._node.identity);
      // assert(
      //   Buffer.compare(target, this._node.identity) === 0,
      //   'Invalid target in proof'
      // );
      // assert(method === payload[0].method, 'Invalid proof for called method');

      let now = Date.now();

      assert(utils.satisfiesDifficulty(utils.hash160(stamp.toString()),
        this._opts.difficulty), 'Invalid HashCash stamp');
      assert(
        now - Math.abs(stamp.date) <= this._opts.timeframe,
        'HashCash stamp is expired'
      );
    } catch (err) {
      return callback(err);
    }

    this._cache.set(stamp.toString(), 1);
    callback(null, data);
  }

  /**
   * Add proof of work to outgoing message
   * @implements {Messenger~serializer}
   */
  prove(data, encoding, callback) {
    let [id, buffer, target] = data;
    let now = Date.now();
    let payload = jsonrpc.parse(buffer.toString('utf8')).map((obj) => {
      return obj.payload;
    });
    // console.log("---- OUTGOING MASSAGE ~ | ~");
    // console.log(payload);
    // console.log(this._opts.methods);
    let stampMessage = (this._opts.methods.includes(payload[0].method) ||
                       this._opts.methods.length === 0) &&
                       typeof payload[0].method !== 'undefined';
    if (!stampMessage) {
      return callback(null, data);
    }

    this._node.logger.warn(`mining hashcash stamp for ${payload[0].method}`);
    HashCashPlugin.create(
      this._node.identity.toString('hex'),
      target[0],
      payload[0].method,
      this._opts.difficulty,
      (err, result) => {
          console.log('Err' + err);
        let delta = Date.now() - now;
        let proof = jsonrpc.notification(HashCashPlugin.METHOD, [
          result.header
        ]);

        this._node.logger.debug(`mined stamp ${result.header} in ${delta}ms`);
        payload.push(proof);
        callback(null, [
          id,
          Buffer.from(JSON.stringify(payload), 'utf8'),
          target
        ]);
      }
    );
  }

  /**
   * Parses hashcash stamp header into an object
   * @static
   * @param {string} header - Hashcash header proof stamp
   * @returns {module:kadence/hashcash~HashCashPlugin~stamp}
   */
  static parse(header) {
    let parts = header.split(':');
    let parsed = {
      ver: parseInt(parts[0]),
      bits: parseInt(parts[1]),
      date: parseInt(parts[2]),
      resource: parts[3],
      ext: '',
      rand: parts[5],
      counter: parseInt(parts[6], 16),
      toString() {
        return [
          this.ver, this.bits, this.date, this.resource,
          this.ext, this.rand, this.counter.toString(16)
        ].join(':');
      }
    };

    return parsed;
  }
  /**
   * @typedef module:kadence/hashcash~HashCashPlugin~stamp
   * @property {number} ver - Hashcash version
   * @property {number} bits - Number of zero bits of difficulty
   * @property {number} date - UNIX timestamp
   * @property {string} resource - Sender and target node identities
   * @property {string} ext - Empty string
   * @property {string} rand - String encoded random number
   * @property {number} counter - Base 16 counter
   * @property {function} toString - Reserializes the parsed header
   */

  /**
   * Creates the hashcash stamp header
   * @static
   * @param {string} sender
   * @param {string} target
   * @param {string} method
   * @param {number} difficulty
   * @param {function} callback
   */
  /* eslint max-params: [2, 5] */
  static create(sender = '00', target = '00', method = '00', bits = 8, cb) {
      console.log(sender, target, method, bits);
    let header = {
      ver: 1,
      bits: bits,
      date: Date.now(),
      resource: Buffer.concat([
        Buffer.from(sender, 'hex'),
        Buffer.from(target, 'hex'),
        Buffer.from(method)
      ]).toString('hex'),
      ext: '',
      rand: crypto.randomBytes(12).toString('base64'),
      counter: Math.ceil(Math.random() * 10000000000),
      toString() {
        return [
          this.ver, this.bits, this.date, this.resource,
          this.ext, this.rand, this.counter.toString(16)
        ].join(':');
      }
    };

    function isSolution() {
      return utils.satisfiesDifficulty(utils.hash160(header.toString()), bits);
    }

    async.whilst(() => !isSolution(), (done) => {
      setImmediate(() => {
        header.counter++;
        done();
      });
    }, () => {
      cb(null, {
        header: header.toString(),
        time: Date.now() - header.date
      });
    });
  }

}

/**
 * Registers the {@link module:kadence/hashcash~HashCashPlugin} with an
 * {@link AbstractNode}
 * @param {object} [options]
 * @param {string[]} [options.methods=[]] - RPC methods to enforce hashcash
 * @param {number} [options.difficulty=8] - Leading zero bits in stamp
 * @param {number} [options.timeframe=172800000] - Timestamp valid window
 */
module.exports = function(options) {
  return function(node) {
    return new HashCashPlugin(node, options);
  }
};

module.exports.HashCashPlugin = HashCashPlugin;
