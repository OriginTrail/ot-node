/**
 * @module kadence/permission
 */

'use strict';

const assert = require('assert');
const utils = require('./utils');
const constants = require('./constants');
const secp256k1 = require('secp256k1');
const async = require('async');
const mkdirp = require('mkdirp');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { Readable } = require('stream');
const { Transform } = require('stream');


/**
 * Represents a solution that can be serialized and stored
 */
class PermissionSolution {

  /**
   * @constructor
   * @param {buffer} solution - Byte representation of the solution input
   * @param {buffer} [owner] - Identity key of owner
   */
  constructor(solution) {
    assert(solution.length === 260, 'Invalid solution length');

    this.origin = solution.slice(0, 33);
    this.noise = solution.slice(33, 66);
    this.originSignature = solution.slice(66, 130);
    this.issuer = solution.slice(130, 163);
    this.owner = solution.slice(163, 196);
    this.issuerSignature = solution.slice(196, 260);
    this.result = utils.scrypt(Buffer.concat([
      this.origin,
      this.noise,
      this.originSignature
    ]));
  }

  /**
   * Signs the solution with the supplied private key
   * @param {buffer} prv - Private key for signatures
   * @returns {module:kadence/permission~PermissionSolution}
   */
  signOrigin(prv) {
    assert(Buffer.compare(secp256k1.publicKeyCreate(prv), this.origin) === 0,
      'Refusing to sign solution to which you are not the origin');

    this.originSignature = secp256k1.sign(
      utils.hash256(Buffer.concat([this.origin, this.noise])),
      prv
    ).signature;

    return this;
  }

  /**
   * Signs the solution with the supplied private key
   * @param {buffer} prv - Private key for signatures
   * @returns {module:kadence/permission~PermissionSolution}
   */
  signIssuance(prv) {
    assert(Buffer.compare(secp256k1.publicKeyCreate(prv), this.issuer) === 0,
      'Refusing to sign solution to which you are not the owner');

    this.issuerSignature = secp256k1.sign(
      utils.hash256(Buffer.concat([this.issuer, this.owner])),
      prv
    ).signature;

    return this;
  }

  /**
   * Verifies the solution is valid
   * @returns {module:kadence/permission~PermissionSolution}
   */
  verify() {
    assert(this.toBuffer().length === 260, 'Invalid solution length');
    assert(utils.satisfiesDifficulty(this.result,
      constants.SOLUTION_DIFFICULTY), 'Invalid solution difficulty');
    assert(secp256k1.verify(utils.hash256(
      Buffer.concat([this.origin, this.noise])
    ), this.originSignature, this.origin), 'Invalid signature from origin');
    assert(secp256k1.verify(utils.hash256(
      Buffer.concat([this.issuer, this.owner])
    ), this.issuerSignature, this.issuer), 'Invalid signature from issuer');

    return this;
  }

  /**
   * Converts to a buffer
   * @returns {buffer}
   */
  toBuffer() {
    return Buffer.concat([
      this.origin,
      this.noise,
      this.originSignature,
      this.issuer,
      this.owner,
      this.issuerSignature
    ]);
  }

  /**
   * Serializes the solution object for storage in the DHT
   * @returns {string[]}
   */
  pack() {
    return [
      utils.hash160(this.result).toString('hex'),
      this.toBuffer().toString('hex')
    ];
  }

}

/**
 * Ensures that a valid proof of work solution is included in every STORE
 * message and that the it's owner is the only identity allowed to mutate the
 * entry
 */
class PermissionRules {

  /**
   * @constructor
   * @param {KademliaNode} node
   */
  constructor(node) {
    this.node = node;
  }

  /**
   * Performs all validation rules to STORE a value
   * @param {AbstractNode~request} request
   * @param {AbstractNode~response} response
   * @param {AbstractNode~next} next
   */
  store(request, response, next) {
    let [key, item] = request.params;
    let solution, value, signature;

    try {
      solution = new PermissionSolution(Buffer.from(item.value[0], 'hex'));
      value = item.value[1];
      signature = item.value[2];

      assert(secp256k1.verify(utils.hash256(Buffer.from(value, 'hex')),
        Buffer.from(signature, 'hex'), solution.owner),
        'Invalid signature from solution owner');
      assert(utils.isHexaString(value), 'Value must be serialized as hex');
      assert(key === utils.hash160(solution.result).toString('hex'),
        'Key must be the RMD-160 hash of the solution result');
    } catch (err) {
      return next(err);
    }

    next();
  }

}

/**
 * Permissioned entry solver. Accepts a private key and exposes a
 * readable stream of signed solutions for import into a
 * {@link PermissionWallet}.
 */
class PermissionSolver extends Readable {

  static get difficulty() {
    return constants.SOLUTION_DIFFICULTY;
  }

  /**
   * @constructor
   * @param {buffer} privateKey - Private identity key to solve
   */
  constructor(privateKey) {
    super({ objectMode: true });
    assert(secp256k1.privateKeyVerify(privateKey),
      'Invalid private key supplied');

    this.privateKey = privateKey;
    this.publicKey = secp256k1.publicKeyCreate(this.privateKey);
  }

  /**
   * @private
   * @fires PermissionSolver#data
   */
  _read() {
    const publicKey = this.publicKey;
    const privateKey = this.privateKey;

    let attempts = 0;
    let begin = Date.now();
    let solution, result = Buffer.alloc(32).fill(255);

    function solutionFound() {
      return utils.satisfiesDifficulty(result, PermissionSolver.difficulty);
    }

    function attemptSolution(next) {
      const noise = utils.noise33();

      solution = Buffer.concat([
        publicKey,
        noise,
        secp256k1.sign(utils.hash256(
          Buffer.concat([publicKey, noise])), privateKey).signature
      ]);

      utils.scrypt(solution, (err, hash) => {
        /* istanbul ignore if */
        if (err) {
          return next();
        }

        result = hash;
        attempts++;
        next();
      });
    }

    async.until(solutionFound, attemptSolution, err => {
      /* istanbul ignore if */
      if (err) {
        return this.emit('error', err);
      }

      const sol = new PermissionSolution(Buffer.concat([
        solution,
        publicKey,
        publicKey,
        Buffer.alloc(64).fill(0) // NB: Empty field for issuer sig
      ]));

      sol.signOrigin(this.privateKey);
      sol.signIssuance(this.privateKey);

      try {
        sol.verify();
      } catch (err) {
        /* istanbul ignore next */
        return this.emit('error', err);
      }

      this.push({
        time: Date.now() - begin,
        attempts,
        solution: sol
      });
    });
  }

  /**
   * @event PermissionSolver#data
   * @type {object}
   * @property {number} time - Time it took to find solution
   * @property {number} attempts - Attempts before finding solution
   * @property {PermissionSolution} solution
   */

}


/**
 * Manages owned solutions as files in a directory
 */
class PermissionWallet extends EventEmitter {

  /**
   * @constructor
   * @param {string} directory - Path to wallet directory
   * @param {buffer} privateKey - Owner private key
   */
  constructor(directory, privateKey) {
    super();
    assert(fs.existsSync(directory), 'Invalid wallet directory');
    assert(privateKey && privateKey.length === 32, 'Invalid private key');

    this.directory = directory;
    this.privateKey = privateKey;
  }

  /**
   * @property {string[]} solutions - List of solution results
   */
  get solutions() {
    return fs.readdirSync(this.directory).filter(name => {
      return !fs.statSync(path.join(this.directory, name)).isDirectory();
    });
  }

  /**
   * @property {number} balance - Total number of solutions stored
   */
  get balance() {
    return this.solutions.length;
  }

  /**
   * Scans all solutions in the wallet and moves invalid ones to a directory
   * named ".invalid"
   * @returns {Promise}
   */
  validate() {
    return new Promise(resolve => {
      mkdirp.sync(path.join(this.directory, '.invalid'));
      mkdirp.sync(path.join(this.directory, '.transferred'));
      async.eachSeries(this.solutions, (key, next) => {
        /* eslint max-statements: [2, 22] */
        const invalidate = () => {
          fs.rename(path.join(this.directory, key),
            path.join(this.directory, '.invalid', key), next);
        };

        const archive = () => {
          fs.rename(path.join(this.directory, key),
            path.join(this.directory, '.transferred', key), next);
        };

        let solution = null;

        try {
          solution = this.get(key);
        } catch (err) {
          invalidate();
          return next();
        }

        const publicKey = secp256k1.publicKeyCreate(this.privateKey);
        const isOwner = Buffer.compare(solution.owner, publicKey) === 0;
        const isIssuer = Buffer.compare(solution.issuer, publicKey) === 0;

        if (!isOwner) {
          if (isIssuer) {
            try {
              solution.verify();
            } catch (err) {
              return invalidate();
            }
            archive();
          } else {
            return invalidate();
          }
        } else {
          try {
            solution.verify();
          } catch (err) {
            return invalidate();
          }
          next();
        }
      }, resolve);
    });
  }

  /**
   * Returns the {@link PermissionSolution} by it's result key
   * @param {buffer|string} key - solution key to retrieve
   * @returns {PermissionSolution}
   */
  get(key) {
    if (Buffer.isBuffer(key)) {
      key = key.toString('hex');
    }

    assert(fs.existsSync(path.join(this.directory, key)),
      'Solution does not exist in wallet');

    return new PermissionSolution(
      fs.readFileSync(path.join(this.directory, key))
    );
  }

  /**
   * Creates or overwrites a solution
   * @param {PermissionSolution} solution - Solution to insert
   */
  put(solution) {
    assert(solution instanceof PermissionSolution,
      'Invalid solution object supplied');
    assert(Buffer.compare(solution.owner,
      secp256k1.publicKeyCreate(this.privateKey)) === 0,
      'Refusing to insert solution - you are not the owner');
    solution.verify();
    fs.writeFileSync(path.join(this.directory,
      solution.result.toString('hex')), solution.toBuffer());
  }

  /**
   * Transfers ownership of a solution to a new public key and removes the
   * solution from the wallet
   * @param {string|buffer} solutionKey - solution key to transfer
   * @param {buffer} publicKey - New owner key of the solution
   * @returns {PermissionSolution}
   */
  transfer(solutionKey, publicKey) {
    const solution = this.get(solutionKey);

    solution.issuer = solution.owner;
    solution.owner = publicKey;

    solution.sign(this.privateKey);
    solution.verify();
    mkdirp.sync(path.join(this.directory, '.transferred'));
    fs.renameSync(path.join(this.directory, solutionKey.toString('hex')),
      path.join(this.directory, '.transferred', solutionKey));

    return solution;
  }

}

/**
 * Includes a proof of work solution in STORE messages and exposes a
 * {@link PermissionWallet} for storing {@link PermissionSolution}s that come
 * from a {@link PermissionSolver}
 */
class PermissionPlugin {

  /**
   * @constructor
   * @param {KademliaNode} node
   * @param {object} options
   * @param {buffer} options.privateKey - ECDSA private key buffer
   * @param {string} options.walletPath - Directory to store solutions
   */
  constructor(node, options) {
    this.node = node;
    this.node.wallet = new PermissionWallet(
      options.walletPath,
      options.privateKey
    );
    this.node.__iterativeStore = node.iterativeStore.bind(this.node);
    this.node.iterativeStore = this.iterativeStore.bind(this);
    this.rules = new PermissionRules(this.node);

    this.node.use('STORE', this.rules.store.bind(this.rules));
    this.node.replicatePipeline.prepend(new Transform({
      objectMode: true,
      transform: (data, enc, cb) => this._transformReplicate(data, cb)
    }))
  }

  /**
   * @private
   */
  _transformReplicate(data, callback) {
    try {
      data.key = new PermissionSolution(
        Buffer.from(data.value.value[0], 'hex')
      );
    } catch (err) {
      /* istanbul ignore next */
      return callback(err);
    }

    callback(null, data);
  }

  /**
   * Performs additional solution routines before storing a value
   * @param {PermissionSolution} solution - The permission solution to unlock
   * @param {buffer} value - Value to store in DHT entry
   * @param {KademliaNode~iterativeStoreCallback} callback
   */
  iterativeStore(solution, value, callback) {
    const item = this.node._createStorageItem(value);

    try {
      assert(solution instanceof PermissionSolution,
        'Invalid solution object supplied');
    } catch (err) {
      return callback(err);
    }

    const [hexKey, hexSolution] = solution.pack();
    const hexValue = Buffer.isBuffer(item.value)
      ? item.value.toString('hex')
      : item.value[1];
    const { signature } = Buffer.isBuffer(item.value)
      ? secp256k1.sign(utils.hash256(Buffer.from(hexValue, 'hex')),
                       this.node.wallet.privateKey)
      : { signature: Buffer.from(item.value[2], 'hex') };
    const [key, val] = [
      hexKey,
      [hexSolution, hexValue, signature.toString('hex')]
    ];

    this.node.__iterativeStore(key, val, callback);
  }

}

/**
 * Registers a {@link PermissionPlugin} with a {@link KademliaNode}
 * @param {object} options
 * @param {buffer} options.privateKey - ECDSA private key buffer
 * @param {string} options.walletPath - Directory to store solutions
 */
module.exports = function(options) {
  return function(node) {
    return new PermissionPlugin(node, options);
  }
};

module.exports.PermissionPlugin = PermissionPlugin;
module.exports.PermissionRules = PermissionRules;
module.exports.PermissionSolution = PermissionSolution;
module.exports.PermissionSolver = PermissionSolver;
module.exports.PermissionWallet = PermissionWallet;
