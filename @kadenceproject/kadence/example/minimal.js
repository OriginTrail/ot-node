/**
 * @example kadence/example/minimal
 */

'use strict';

// Import dependencies
const bunyan = require('bunyan');
const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kadence = require('@kadenceproject/kadence');

// Construct a kademlia node interface; the returned `KademliaNode` object
// exposes:
// - router
// - rpc
// - storage
// - identity
const node = new kadence.KademliaNode({
  transport: new kadence.HTTPTransport(),
  storage: levelup(encoding(leveldown('path/to/storage.db'))),
  contact: { hostname: 'localhost', port: 1337 }
});

// When you are ready, start listening for messages and join the network
// The Node#listen method takes different arguments based on the transport
// adapter being used
node.listen(1337);

// Join a known peer by it's [identity, contact]
node.join(['ea48d3f07a5241291ed0b4cab6483fa8b8fcc127', {
  hostname: 'localhost',
  port: 8080
}], () => {
  // Add 'join' callback which indicates peers were discovered and
  // our node is now connected to the overlay network
  node.logger.info(`Connected to ${node.router.length} peers!`)

  // Base protocol exposes:
  // * node.iterativeFindNode(key, callback)
  // * node.iterativeFindValue(key, callback)
  // * node.iterativeStore(key, value, callback)
});


