'use strict';

const { expect } = require('chai');
const kadence = require('..');
const network = require('./fixtures/node-generator');
const hashcash = require('../lib/plugin-hashcash');


kadence.constants.T_RESPONSETIMEOUT = 4000;

describe('@module kadence/hashcash + @class UDPTransport', function() {

  let [node1, node2] = network(2, kadence.UDPTransport);

  before(function(done) {
    [node1, node2].forEach((node) => {
      node.hashcash = node.plugin(hashcash());
      node.listen(node.contact.port);
    });
    setTimeout(done, 1000);
  });

  after(function() {
    process._getActiveHandles().forEach((h) => h.unref());
  })

  it('should stamp and verify proof of work', function(done) {
    this.timeout(8000);
    node1.ping([node2.identity.toString('hex'), node2.contact], (err) => {
      expect(err).to.equal(null);
      done();
    });
  });

});
