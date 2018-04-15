/**
 * @module kadence
 * @license AGPL-3.0
 * @author Gordon Hall https://github.com/bookchin
 */

'use strict';

/**
 * Returns a new {@link KademliaNode}
 */
module.exports = function(options) {
  return new module.exports.KademliaNode(options);
};

/** {@link KademliaNode} */
module.exports.KademliaNode = require('./lib/node-kademlia');

/** {@link KademliaRules} */
module.exports.KademliaRules = require('./lib/rules-kademlia');

/** {@link AbstractNode} */
module.exports.AbstractNode = require('./lib/node-abstract');

/** {@link ErrorRules} */
module.exports.ErrorRules = require('./lib/rules-errors');

/** {@link Bucket} */
module.exports.Bucket = require('./lib/bucket');

/** {@link Control} */
module.exports.Control = require('./lib/control');

/** {@link Messenger} */
module.exports.Messenger = require('./lib/messenger');

/** {@link RoutingTable} */
module.exports.RoutingTable = require('./lib/routing-table');

/** {@link UDPTransport} */
module.exports.UDPTransport = require('./lib/transport-udp');

/** {@link HTTPTransport} */
module.exports.HTTPTransport = require('./lib/transport-http');

/** {@link HTTPSTransport} */
module.exports.HTTPSTransport = require('./lib/transport-https');

/** {@link module:kadence/hashcash} */
module.exports.hashcash = require('./lib/plugin-hashcash');

/** {@link module:kadence/hibernate} */
module.exports.hibernate = require('./lib/plugin-hibernate');

/** {@link module:kadence/onion} */
module.exports.onion = require('./lib/plugin-onion');

/** {@link module:kadence/quasar} */
module.exports.quasar = require('./lib/plugin-quasar');

/** {@link module:kadence/spartacus} */
module.exports.spartacus = require('./lib/plugin-spartacus');

/** {@link module:kadence/traverse} */
module.exports.traverse = require('./lib/plugin-traverse');

/** {@link module:kadence/eclipse} */
module.exports.eclipse = require('./lib/plugin-eclipse');

/** {@link module:kadence/permission} */
module.exports.permission = require('./lib/plugin-permission');

/** {@link module:kadence/rolodex} */
module.exports.rolodex = require('./lib/plugin-rolodex');

/** {@link module:kadence/contentaddress} */
module.exports.contentaddress = require('./lib/plugin-contentaddress');

/** {@link module:kadence/constants} */
module.exports.constants = require('./lib/constants');

/** {@link module:kadence/version} */
module.exports.version = require('./lib/version');

/** {@link module:kadence/utils} */
module.exports.utils = require('./lib/utils');

/** {@link module:kadence/logger} */
module.exports.logger = require('./lib/logger');
