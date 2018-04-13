'use strict';

const { expect } = require('chai');
const kad = require('..');

describe('@class AbstractNode / @class UDPTransport', function() {

  const [node1, node2] = require('./fixtures/node-generator')(
    2,
    kad.UDPTransport
  );

  before(function() {
    node1.listen(node1.contact.port, node1.contact.hostname);
    node2.listen(node2.contact.port, node2.contact.hostname);
  });

  after(function() {
    node1.transport.socket.close();
    node2.transport.socket.close();
  });

  it('node1 should send TEST to node2 and receive success', function(done) {
    node2.use('TEST', function(request, response) {
      expect(request.params[0]).to.equal('test parameter');
      response.send(['test result']);
    });
    node1.send(
      'TEST',
      ['test parameter'],
      [node2.identity.toString('hex'), node2.contact],
      function(err, result) {
        expect(err).to.equal(null);
        expect(result[0]).to.equal('test result');
        done();
      }
    );
  });

  it('node2 should send TEST to node2 and receive error', function(done) {
    node1.use('TEST', function(request, response) {
      expect(request.params[0]).to.equal('test parameter');
      response.error('test error', 500);
    });
    node2.send(
      'TEST',
      ['test parameter'],
      [node1.identity.toString('hex'), node1.contact],
      function(err) {
        expect(err.message).to.equal('test error');
        done();
      }
    );
  });

});
