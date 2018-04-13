'use strict';

const { expect } = require('chai');
const kadence = require('..');
const network = require('./fixtures/node-generator');
const spartacus = require('../lib/plugin-spartacus');
const { randomBytes } = require('crypto');


kadence.constants.T_RESPONSETIMEOUT = 1000;

describe('@module kadence/spartacus + @class UDPTransport)', function() {

  let [node1, node2, node3] = network(3, kadence.UDPTransport);
  let node3xpub = null;

  before(function(done) {
    [node1, node2, node3].forEach((node, i) => {
      if (i === 0) {
        node.spartacus = node.plugin(spartacus(/* autogenerate */));
      } else {
        node.spartacus = node.plugin(spartacus(
          kadence.utils.toExtendedFromPrivateKey(randomBytes(32)),
          -1
        ));
      }
      node.listen(node.contact.port);
    });
    setTimeout(done, 1000);
  });

  it('should sign and verify messages', function(done) {
    node1.ping([node2.identity.toString('hex'), node2.contact], (err) => {
      expect(err).to.equal(null);
      done();
    });
  });

  it('should sign and verify messages', function(done) {
    node2.ping([node1.identity.toString('hex'), node1.contact], (err) => {
      expect(err).to.equal(null);
      done();
    });
  });

  it('should fail to validate if reflection attack', function(done) {
    this.timeout(4000);
    node3xpub = node3.contact.xpub;
    node3.contact.xpub = 'invalid';
    node3.ping([node1.identity.toString('hex'), node1.contact], (err) => {
      expect(err.message).to.equal('Timed out waiting for response');
      done();
    });
  });

  it('should fail to validate if no response', function(done) {
    this.timeout(4000);
    node3.contact.xpub = node3xpub;
    node3.contact.port = 0;
    node1.spartacus.setValidationPeriod(0);
    node3.ping([node1.identity.toString('hex'), node1.contact], (err) => {
      expect(err.message).to.equal('Timed out waiting for response');
      done();
    });
  });

});
