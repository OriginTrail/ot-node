'use strict';

const { expect } = require('chai');
const { stub } = require('sinon');
const onion = require('../lib/plugin-onion');
const { EventEmitter } = require('events');
const proxyquire = require('proxyquire');
const logger = { info: stub() };


describe('@module kademlia/onion', function() {

  describe('@constructor', function() {

    it('should establish a hidden service on node#listen', function(done) {
      let controller = new EventEmitter();
      controller.getInfo = stub().callsArgWith(
        1,
        null,
        '"127.0.0.1:9050"'
      );
      controller.addEventListeners = stub().callsArg(1);
      controller.removeEventListeners = stub().callsArg(0);
      let onionStubbed = proxyquire('../lib/plugin-onion', {
        hsv3: stub().returns(controller),
        fs: {
          readFileSync: stub().returns(
            Buffer.from('myonionaddress.onion')
          )
        }
      });
      let transport = {
        _createRequest: stub()
      };
      let node = new EventEmitter();
      node.transport = transport;
      node.listen = stub().callsArg(2);
      node.contact = { port: 80 };
      node.logger = logger;
      let plugin = new onionStubbed.OnionPlugin(node);
      node.listen(8080, function() {
        expect(node.contact.hostname).to.equal('myonionaddress.onion');
        expect(node.contact.port).to.equal(80);
        expect(plugin.tor).to.equal(controller);
        done();
      });
      setTimeout(() => {
        controller.emit('ready');
        setTimeout(() => controller.emit('STATUS_CLIENT', [
          'NOTICE CIRCUIT_ESTABLISHED'
        ]), 20);
      }, 20);
    });

    it('should emit error if tor control fails', function(done) {
      let controller = new EventEmitter();
      let onionStubbed = proxyquire('../lib/plugin-onion', {
        hsv3: stub().returns(controller)
      });
      let transport = {
        _createRequest: stub()
      };
      let node = new EventEmitter();
      node.transport = transport;
      node.listen = stub().callsArg(2);
      node.contact = {};
      node.logger = logger;
      let plugin = new onionStubbed.OnionPlugin(node);
      node.once('error', (err) => {
        expect(plugin.tor).to.equal(controller);
        expect(err.message).to.equal('Tor control failed');
        done();
      });
      node.listen(8080);
      setTimeout(
        () => controller.emit('error', new Error('Tor control failed')),
        20
      );
    });

  });

});

describe('@exports', function() {

  it('should return a plugin function', function() {
    let transport = { _createRequest: stub() };
    let node = { transport: transport, listen: stub() };
    let options = {};
    let plugin = onion(options);
    expect(typeof plugin).to.equal('function');
    let instance = plugin(node);
    expect(instance).to.be.instanceOf(onion.OnionPlugin);
  });

});
