'use strict';

const { expect } = require('chai');
const network = require('./fixtures/node-generator');
const kadence = require('..');
const contentaddress = require('../lib/plugin-contentaddress');
const { createHash } = require('crypto');


describe('@module kadence/contentaddress + @class UDPTransport', function() {

  let [node1, node2] = network(2, kadence.UDPTransport);
  let data = Buffer.from('data');
  let key = createHash('rmd160').update(data).digest('hex');

  before(function(done) {
    [node1, node2].forEach((node) => {
      node.plugin(contentaddress());
      node.listen(node.contact.port);
    });
    setTimeout(() => {
      node1.join([
        node2.identity.toString('hex'),
        node2.contact
      ], () => done());
    }, 1000);
  });

  it('should succeed in storing item', function(done) {
    node1.iterativeStore(key, data.toString('base64'), (err, stored) => {
      expect(err).to.equal(null);
      expect(stored).to.equal(2);
      done();
    });
  });

  it('should fail in storing item', function(done) {
    node2.iterativeStore(
      createHash('rmd160').update(Buffer.from('fail')).digest('hex'),
      data,
      (err, stored) => {
        expect(stored).to.equal(0);
        done();
      }
    );
  });

});
