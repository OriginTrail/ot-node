'use strict';

const { expect } = require('chai');
const kadence = require('..');
const network = require('./fixtures/node-generator');
const hibernate = require('../lib/plugin-hibernate');


describe('@module kadence/hibernate + @class UDPTransport', function() {

  let [node1, node2] = network(2, kadence.UDPTransport);

  before(function(done) {
    [node1, node2].forEach((node) => {
      node.plugin(hibernate({
        limit: '222b',
        interval: '2s',
        reject: ['PING']
      }));
      node.listen(node.contact.port);
    });
    setTimeout(done, 1000);
  });

  it('should succeed in exchanging ping', function(done) {
    node1.ping([node2.identity.toString('hex'), node2.contact], (err) => {
      expect(err).to.equal(null);
      done();
    });
  });

  it('should fail in exchanging ping', function(done) {
    node2.ping([node1.identity.toString('hex'), node1.contact], (err) => {
      expect(err.message).to.equal('Hibernating, try PING again later');
      done();
    });
  });

  it('should succeed in exchanging ping after reset', function(done) {
    this.timeout(3000);
    setTimeout(() => {
      node2.ping([node1.identity.toString('hex'), node1.contact], (err) => {
        expect(err).to.equal(null);
        done();
      });
    }, 2000);
  });

});
