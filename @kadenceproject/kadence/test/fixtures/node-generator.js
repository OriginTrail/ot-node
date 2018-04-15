'use strict';

const bunyan = require('bunyan');
const levelup = require('levelup');
const memdown = require('memdown');
const kadence = require('../..');
const encoding = require('encoding-down');

let startPort = 45000;


// NB: Increase response timeout for test because running multiple nodes
// NB: in a single process can produce a lot of latency
kadence.constants.T_RESPONSETIMEOUT = 30000;

module.exports = function(numNodes, Transport) {

  const nodes = [];

  const logger = bunyan.createLogger({
    levels: ['fatal'],
    name: 'node-kademlia'
  });
  const storage = levelup(encoding(memdown()));

  function createNode() {
    let transport = new Transport();
    let contact = { hostname: 'localhost', port: startPort++ };

    return new kadence.KademliaNode({
      transport: transport,
      contact: contact,
      storage: storage,
      logger: logger
    });
  }

  for (let i = 0; i < numNodes; i++) {
    nodes.push(createNode());
  }

  return nodes;
};
