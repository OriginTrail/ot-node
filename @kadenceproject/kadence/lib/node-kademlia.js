'use strict';

const async = require('async');
const { Writable: WritableStream } = require('stream');
const constants = require('./constants');
const utils = require('./utils');
const AbstractNode = require('./node-abstract');
const KademliaRules = require('./rules-kademlia');
const ContactList = require('./contact-list');
const MetaPipe = require('metapipe');


/**
 * Extends {@link AbstractNode} with Kademlia-specific rules
 * @class
 * @extends {AbstractNode}
 */
class KademliaNode extends AbstractNode {

  /**
   * @typedef {object} KademliaNode~entry
   * @property {string|object|array} value - The primary entry value
   * @property {string} publisher - Node identity of the original publisher
   * @property {number} timestamp - Last update/replicate time
   */

  /**
   * @constructor
   */
  constructor(options) {
    super(options);

    this._lookups = new Map(); // NB: Track the last lookup time for buckets
    this._pings = new Map();
    this._updateContactQueue = async.queue(
      (task, cb) => this._updateContactWorker(task, cb),
      1
    );

    this.replicatePipeline = new MetaPipe({ objectMode: true });
    this.expirePipeline = new MetaPipe({ objectMode: true });
  }

  /**
   * Adds the kademlia rule handlers before calling super#listen()
   */
  listen() {
    let handlers = new KademliaRules(this);

    this.use('PING', handlers.ping.bind(handlers));
    this.use('STORE', handlers.store.bind(handlers));
    this.use('FIND_NODE', handlers.findNode.bind(handlers));
    this.use('FIND_VALUE', handlers.findValue.bind(handlers));

    setInterval(() => this.refresh(0), constants.T_REFRESH);
    setInterval(() => this.replicate(() => this.expire()),
                constants.T_REPLICATE);

    super.listen(...arguments);
  }

  /**
   * Inserts the given contact into the routing table and uses it to perform
   * a {@link KademliaNode#iterativeFindNode} for this node's identity,
   * then refreshes all buckets further than it's closest neighbor, which will
   * be in the occupied bucket with the lowest index
   * @param {Bucket~contact} peer - Peer to bootstrap from
   * @param {function} [joinListener] - Function to set as join listener
   * @emits AbstractNode#join
   */
  join([identity, contact], callback) {
    /* istanbul ignore else */
    if (callback) {
      this.once('join', callback);
      this.once('error', callback);
    }
    console.log("Adding identity: " + identity);
    this.router.addContactByNodeId(identity, contact);
    console.log(this.router.getClosestBucket());
    async.series([
      (next) => this.iterativeFindNode(this.identity.toString('hex'), next),
      (next) => this.refresh(this.router.getClosestBucket() + 1, next)
    ], (err) => {
      if (err) {
          console.log('JOIN ERR');
          console.log(err)
        this.emit('error', err);
      } else {
        this.emit('join');
      }

      if (callback) {
        this.removeListener('join', callback);
        this.removeListener('error', callback);
      }
    });
  }

  /**
   * Sends a PING message to the supplied contact
   * @param {Bucket~contact} peer
   * @param {KademliaNode~pingCallback} callback
   */
  ping(contact, callback) {
    const start = Date.now();

    this.send('PING', [], contact, (err) => {
      console.log('sending ping');
      console.log("Contact: " + contact);
      callback(err, Date.now() - start);
    });
  }
  /**
   * @callback KademliaNode~pingCallback
   * @param {error|null} error
   * @param {number} latency - Milliseconds before response received
   */

  /**
   * @private
   */
  _createStorageItem(value) {
    const keys = Object.keys(value);
    const alreadyHasMetadata = keys.includes('value') &&
                               keys.includes('publisher') &&
                               keys.includes('timestamp');

    if (alreadyHasMetadata) {
      value.timestamp = Date.now();
      value.publisher = value.publisher.toString('hex');
      return value;
    }

    return {
      value: value,
      timestamp: Date.now(),
      publisher: this.identity.toString('hex')
    };
  }

  /**
   * Performs a {@link KademliaNode#iterativeFindNode} to collect K contacts
   * closests to the given key, sending a STORE message to each of them
   * @param {buffer|string} key - Key to store data under
   * @param {buffer|string|object} value - Value to store by key
   * @param {KademliaNode~iterativeStoreCallback} callback
   */
  iterativeStore(key, value, callback) {
    key = key.toString('hex');
    const self = this;
    let stored = 0;

    function createStoreRpc(target) {
      return ['STORE', [key, self._createStorageItem(value)], target];
    }

    function dispatchStoreRpcs(contacts, callback) {
      async.eachLimit(contacts, constants.ALPHA, (target, done) => {
        self.send(...createStoreRpc(target), (err) => {
          stored = err ? stored : stored + 1;
          done();
        });
      }, callback);
    }

    async.waterfall([
      (next) => this.iterativeFindNode(key, next),
      (contacts, next) => dispatchStoreRpcs(contacts, next),
      (next) => {
        this.storage.put(key, this._createStorageItem(value), {
          valueEncoding: 'json'
        }, next);
      }
    ], () => callback(null, stored));
  }
  /**
   * @callback KademliaNode~iterativeStoreCallback
   * @param {error|null} error
   * @param {number} stored - Total nodes who stored the pair
   */

  /**
   * Basic kademlia lookup operation that builds a set of K contacts closest
   * to the given key
   * @param {buffer|string} key - Reference key for node lookup
   * @param {KademliaNode~iterativeFindNodeCallback} callback
   */
  iterativeFindNode(key, callback) {
    key = key.toString('hex');
    //console.log('Finding node: ' + key);
    return this._iterativeFind('FIND_NODE', key, callback);
  }
  /**
   * @callback KademliaNode~iterativeFindNodeCallback
   * @param {error|null} error
   * @param {Bucket~contact[]} contacts - Result of the lookup operation
   */

  /**
   * Kademlia search operation that is conducted as a node lookup and builds
   * a list of K closest contacts. If at any time during the lookup the value
   * is returned, the search is abandoned. If no value is found, the K closest
   * contacts are returned. Upon success, we must store the value at the
   * nearest node seen during the search that did not return the value.
   * @param {buffer|string} key - Key for value lookup
   * @param {KademliaNode~iterativeFindValueCallback} callback
   */
  iterativeFindValue(key, callback) {
    key = key.toString('hex');
    return this._iterativeFind('FIND_VALUE', key, callback);
  }
  /**
   * @callback KademliaNode~iterativeFindValueCallback
   * @param {error|null} error
   * @param {KademliaNode~entry} value
   * @param {null|Bucket~contact} contact - Contact responded with entry
   */

  /**
   * Performs a scan of the storage adapter and performs
   * republishing/replication of items stored. Items that we did not publish
   * ourselves get republished every T_REPLICATE. Items we did publish get
   * republished every T_REPUBLISH.
   * @param {KademliaNode~replicateCallback} [callback]
   */
  replicate(callback = () => null) {
    const self = this;
    const now = Date.now();
    const itemStream = this.storage.createReadStream({ valueEncoding: 'json' });
    const replicateStream = new WritableStream({
      objectMode: true,
      write: maybeReplicate
    });

    function maybeReplicate({ key, value }, enc, next) {
      const isPublisher = value.publisher === self.identity.toString('hex');
      const republishDue = (value.timestamp + constants.T_REPUBLISH) <= now;
      const replicateDue = (value.timestamp + constants.T_REPLICATE) <= now;
      const shouldRepublish = isPublisher && republishDue;
      const shouldReplicate = !isPublisher && replicateDue;

      if (shouldReplicate || shouldRepublish) {
        return self.iterativeStore(key, value, next);
      }

      next();
    }

    function triggerCallback(err) {
      itemStream.removeAllListeners();
      replicateStream.removeAllListeners();
      callback(err);
    }

    itemStream.on('error', triggerCallback);
    replicateStream.on('error', triggerCallback);
    replicateStream.on('finish', triggerCallback);
    itemStream.pipe(this.replicatePipeline).pipe(replicateStream);
  }
  /**
   * @callback KademliaNode~replicateCallback
   * @param {error|null} error
   * @param {number} itemsReplicated
   */

  /**
   * Items expire T_EXPIRE seconds after the original publication. All items
   * are assigned an expiration time which is "exponentially inversely
   * proportional to the number of nodes between the current node and the node
   * whose ID is closest to the key", where this number is "inferred from the
   * bucket structure of the current node".
   * @param {KademliaNode~expireCallback} [callback]
   */
  expire(callback = () => null) {
    const self = this;
    const now = Date.now();
    const itemStream = this.storage.createReadStream({ valueEncoding: 'json' });
    const expireStream = new WritableStream({
      objectMode: true,
      write: maybeExpire
    });

    function maybeExpire({ key, value }, enc, next) {
      if ((value.timestamp + constants.T_EXPIRE) <= now) {
        return self.storage.del(key, next);
      }

      next();
    }

    function triggerCallback(err) {
      itemStream.removeAllListeners();
      expireStream.removeAllListeners();
      callback(err);
    }

    itemStream.on('error', triggerCallback);
    expireStream.on('error', triggerCallback);
    expireStream.on('finish', triggerCallback);
    itemStream.pipe(this.expirePipeline).pipe(expireStream);
  }
  /**
   * @callback KademliaNode~expireCallback
   * @param {error|null} error
   * @param {number} itemsExpired
   */

  /**
   * If no node lookups have been performed in any given bucket's range for
   * T_REFRESH, the node selects a random number in that range and does a
   * refresh, an iterativeFindNode using that number as key.
   * @param {number} startIndex - bucket index to start refresh from
   * @param {KademliaNode~refreshCallback} [callback]
   */
  refresh(startIndex = 0, callback = () => null) {
    const now = Date.now();
    const indices = [
      ...this.router.entries()
    ].slice(startIndex).map((entry) => entry[0]);

    async.eachSeries(indices, (index, next) => {
      const lastBucketLookup = this._lookups.get(index) || 0;
      const needsRefresh = lastBucketLookup + constants.T_REFRESH <= now;

      if (needsRefresh) {
        return this.iterativeFindNode(
          utils.getRandomBufferInBucketRange(this.identity, index)
            .toString('hex'),
          next
        );
      }

      next();
    }, callback);
  }
  /**
   * @callback KademliaNode~refreshCallback
   * @param {error|null} error
   * @param {array} bucketsRefreshed
   */

  /**
   * Builds an list of closest contacts for a particular RPC
   * @private
   */
  _iterativeFind(method, key, callback) {
    function createRpc(target) {
      return [method, [key], target];
    }

    let shortlist = new ContactList(key, [
      ...this.router.getClosestContactsToKey(key, constants.ALPHA)
    ]);
    let closest = shortlist.closest;

    this._lookups.set(utils.getBucketIndex(this.identity, key), Date.now());

    function iterativeLookup(selection, callback, continueLookup = true) {
      if (!selection.length) {
        return callback(null, shortlist.active.slice(0, constants.K));
      }

      async.each(selection, (contact, next) => {
        // NB: mark this node as contacted so as to avoid repeats
        shortlist.contacted(contact);

        this.send(...createRpc(contact), (err, result) => {
          if (err) {
            return next();
          }

          // NB: mark this node as active to include it in any return values
          shortlist.responded(contact);

          // NB: If the result is a contact/node list, just keep track of it
          // NB: Otherwise, do not proceed with iteration, just callback
          if (Array.isArray(result) || method !== 'FIND_VALUE') {
            shortlist.add(result || []).forEach( (contact) => {
              // NB: if it wasn't in the shortlist, we haven't added to the
              // NB: routing table, so do that now.
              this._updateContact(...contact);
            });
            return next();
          }

          // NB: If we did get an item back, get the closest node we contacted
          // NB: who is missing the value and store a copy with them
          const closestMissingValue = shortlist.active[0]

          if (closestMissingValue) {
            this.send('STORE', [key, result], closestMissingValue, () => null);
          }

          // NB: we found a value, so stop searching
          callback(null, result, contact);
          callback = () => {};
        })
      }, () => {

        // NB: If we have reached at least K active nodes, or haven't found a
        // NB: closer node, even on our finishing trip, return to the caller
        // NB: the K closest active nodes.
        if (shortlist.active.length >= constants.K ||
          (closest[0] === shortlist.closest[0] && !continueLookup)
        ) {
          return callback(null, shortlist.active.slice(0, constants.K));
        }

        // NB: we haven't discovered a closer node, call k uncalled nodes and
        // NB: finish up
        if (closest[0] === shortlist.closest[0]) {
          return iterativeLookup.call(
            this,
            shortlist.uncontacted.slice(0, constants.K),
            callback,
            false
          );
        }

        closest = shortlist.closest;

        // NB: continue the lookup with AlPHA close, uncontacted nodes
        iterativeLookup.call(
          this,
          shortlist.uncontacted.slice(0, constants.ALPHA),
          callback,
          true
        );
      });
    }

    iterativeLookup.call(
      this,
      shortlist.uncontacted.slice(0, constants.ALPHA),
      callback,
      true
    );
  }
  /**
   * Adds the given contact to the routing table
   * @private
   */
  _updateContact(identity, contact) {
    this._updateContactQueue.push({ identity, contact }, (err, headId) => {
      if (err) {
        this.router.removeContactByNodeId(headId);
        this.router.addContactByNodeId(identity, contact);
      }
    });
  }

  /**
   * Worker for updating contact in a routing table bucket
   * @private
   */
  _updateContactWorker(task, callback) {
    const { identity, contact } = task;

    if (identity === this.identity.toString('hex')) {
      return callback();
    }

    const now = Date.now();
    const reset = 600000;
    const [, bucket, contactIndex] = this.router.addContactByNodeId(
      identity,
      contact
    );

    const [headId, headContact] = bucket.head;
    const lastPing = this._pings.get(headId);

    if (contactIndex !== -1) {
      return callback();
    }

    if (lastPing && lastPing.responded && lastPing.timestamp > (now - reset)) {
      return callback();
    }

    this.ping([headId, headContact], (err) => {
      this._pings.set(headId, { timestamp: Date.now(), responded: !err });
      callback(err, headId);
    });
  }

}

module.exports = KademliaNode;
