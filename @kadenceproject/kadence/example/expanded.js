/**
 * @example kadence/example/expanded
 */

// NB: For a complete example of a full kadence implementation, see the daemon
// NB: implementation in bin/kadence.js

'use strict';

// Import dependencies
const crypto = require('crypto');
const bunyan = require('bunyan');
const levelup = require('levelup');
const encoding = require('encoding-down');
const leveldown = require('leveldown');
const kadence = require('@kadenceproject/kadence');

// Prepare required options
const storage = levelup(encoding(leveldown('path/to/storage.db')));
const logger = bunyan.createLogger({ name: 'kadence example' });
const transport = new kadence.HTTPTransport();
const identity = kadence.utils.getRandomKeyBuffer();
const contact = { hostname: 'localhost', port: 1337 };

// Construct a kademlia node interface; the returned `Node` object exposes:
// - router
// - rpc
// - storage
// - identity
const node = new kadence.KademliaNode({
  transport,
  storage,
  logger,
  identity,
  contact
});

// Use rule "extensions" from plugins to add additional functionality.
// Plugins can also extend the `KademliaNode` object with additional methods
node.plugin(kadence.quasar());

// Use "global" rules for preprocessing *all* incoming messages
// This is useful for things like blacklisting certain nodes
node.use((request, response, next) => {
  let [identityString] = request.contact

  if ([/* identity blacklist */].includes(identityString)) {
    return next(new Error('You have been blacklisted'));
  }

  next();
});

// Use existing "base" rules to add additional logic to the base kad routes
// This is useful for things like validating key/value pairs
node.use('STORE', (request, response, next) => {
  let [key, val] = request.params;
  let hash = crypto.createHash('rmd160').update(val).digest('hex');

  // Ensure values are content-addressable
  if (key !== hash) {
    return next(new Error('Key must be the RMD-160 hash of value'));
  }

  next();
});

// Use "userland" (that's you!) rules to create your own protocols
node.use('ECHO', (request, response, next) => {
  if ([/* some naughty words */].includes(request.params.message)) {
    return next(new Error(
      `Oh goodness, I dare not say "${request.params.message}"`
    ));
  }

  response.send(request.params);
});

// Define a global custom error handler rule, simply by including the `err`
// argument in the handler
node.use((err, request, response, next) => {
  response.send({ error: err.message });
});

// Define error handlers for specific rules the same way, but including the
// rule name as the first argument
node.use('ECHO', (err, request, response, next) => {
  response.send({
    error: err.message.replace(request.params.message, '[redacted]')
  });
});

// Extend the Node interface with your own plugins
// In many cases, you probably want parity with any userland message routes
// you have defined - in this case for the ECHO method
node.plugin(function(node) {
  node.sendNeighborEcho = (text, callback) => {
    node.send('ECHO', {
      message: text
    }, node.router.getNearestContacts(node.identity, 1).pop(), callback);
  };
});

// When you are ready, start listening for messages and join the network
// The Node#listen method takes different arguments based on the transport
// adapter being used
node.listen(1337);

node.join(['ea48d3f07a5241291ed0b4cab6483fa8b8fcc127', {
  hostname: 'localhost',
  port: 8080
}], () => {
  // Add 'join' callback which indicates peers were discovered and
  // our node is now connected to the overlay network
  logger.info(`Connected to ${node.router.length} peers!`)

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
