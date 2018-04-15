'use strict';

const bunyan = require('bunyan');
const stream = require('stream');
const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire');
const {
  TraversePlugin,
  UPNPStrategy,
} = require('../lib/plugin-traverse');
const logger=  bunyan.createLogger({
  name: 'kadence-traverse-test',
  level: 'fatal'
});


describe('@module kadence/traverse', function() {

  describe('@constructor', function() {

    let sandbox;

    before(() => sandbox = sinon.sandbox.create());

    it('should wrap node#listen', function() {
      let _wrap = sandbox.stub(TraversePlugin.prototype, '_wrapNodeListen');
      let plugin = new TraversePlugin({
        contact: { hostname: '127.0.0.1', port: 8080 },
        logger
      }, []);
      expect(_wrap.called).to.equal(true);
      expect(plugin._originalContact.hostname).to.equal('127.0.0.1');
      expect(plugin._originalContact.port).to.equal(8080);
    });

    after(() => sandbox.restore());

  });

  describe('@private @method _execTraversalStrategies', function() {

    let sandbox;

    before(() => sandbox = sinon.sandbox.create());

    it('should exec strategies until test passes', function(done) {
      let err = new Error('failed');
      let s1 = { exec: sandbox.stub().callsArgWith(1, err) };
      let s2 = { exec: sandbox.stub().callsArgWith(1) };
      let s3 = { exec: sandbox.stub().callsArgWith(1) };
      let _test = sandbox.stub(
        TraversePlugin.prototype,
        '_testIfReachable'
      ).callsArg(0);
      _test.onCall(0).callsArgWith(0, null, false);
      sandbox.stub(TraversePlugin.prototype, '_wrapNodeListen');
      let plugin = new TraversePlugin({
        contact: { hostname: '127.0.0.1', port: 8080 },
        logger
      }, [s1, s2, s3]);
      plugin._execTraversalStrategies(() => {
        expect(s1.exec.called).to.equal(true);
        expect(s2.exec.called).to.equal(true);
        expect(s3.exec.called).to.equal(true);
        expect(_test.callCount).to.equal(2);
        done()
      });
    });

    after(() => sandbox.restore())

  });

  describe('@private @method _testIfReachable', function() {

    let sandbox;

    before(() => {
      sandbox = sinon.sandbox.create();
      sandbox.stub(TraversePlugin.prototype, '_wrapNodeListen');
    });

    it('should callback false if hostname not public', function(done) {
      let plugin = new TraversePlugin({
        contact: { hostname: '127.0.0.1', port: 8080 },
        logger
      }, []);
      plugin._testIfReachable((err, result) => {
        expect(result).to.equal(false);
        done();
      });
    });

    it('should callback false if ping errors', function(done) {
      let plugin = new TraversePlugin({
        contact: { hostname: 'public.hostname', port: 8080 },
        ping: sandbox.stub().callsArgWith(1, new Error('failed')),
        identity: Buffer.from('nodeid'),
        logger
      }, []);
      plugin._testIfReachable((err, result) => {
        expect(result).to.equal(false);
        done();
      });
    });

    it('should callback true if ping succeeds', function(done) {
      let plugin = new TraversePlugin({
        contact: { hostname: 'public.hostname', port: 8080 },
        ping: sandbox.stub().callsArgWith(1, null),
        identity: Buffer.from('nodeid'),
        logger
      }, []);
      plugin._testIfReachable((err, result) => {
        expect(result).to.equal(true);
        done();
      });
    });

    after(() => sandbox.restore())

  });

  describe('@private @method _wrapNodeListen', function() {

    let sandbox;

    before(() => {
      sandbox = sinon.sandbox.create();
    });

    it('should call listen callback', function(done) {
      let listen = sandbox.stub().callsArg(1);
      let node = {
        contact: { hostname: '127.0.0.1', port: 8080 },
        listen,
        logger
      };
      let plugin = new TraversePlugin(node);
      let _exec = sandbox.stub(plugin, '_execTraversalStrategies').callsArg(0);
      node.listen(8080, () => {
        expect(_exec.called).to.equal(true);
        done();
      });
    });

    it('should call node#listen and log error from _exec...', function(done) {
      let listen = sandbox.stub().callsArg(1);
      let error = sandbox.stub();
      let node = {
        contact: { hostname: '127.0.0.1', port: 8080 },
        listen,
        logger: { error }
      };
      let plugin = new TraversePlugin(node);
      sandbox.stub(
        plugin,
        '_execTraversalStrategies'
      ).callsArgWith(0, new Error('failed'));
      node.listen(8080);
      setImmediate(() => {
        expect(error.called).to.equal(true);
        done();
      });
    });

    it('should call node#listen and log warn from _exec...', function(done) {
      let listen = sandbox.stub().callsArg(1);
      let warn = sandbox.stub();
      let node = {
        contact: { hostname: '127.0.0.1', port: 8080 },
        listen,
        logger: { warn }
      };
      let plugin = new TraversePlugin(node);
      sandbox.stub(
        plugin,
        '_execTraversalStrategies'
      ).callsArg(0);
      node.listen(8080);
      setImmediate(() => {
        expect(warn.called).to.equal(true);
        done();
      });
    });

    it('should call node#listen and log info from _exec...', function(done) {
      let listen = sandbox.stub().callsArg(1);
      let info = sandbox.stub();
      let node = {
        contact: { hostname: '127.0.0.1', port: 8080 },
        listen,
        logger: { info }
      };
      let plugin = new TraversePlugin(node);
      sandbox.stub(
        plugin,
        '_execTraversalStrategies'
      ).callsArgWith(0, null, true);
      node.listen(8080);
      setImmediate(() => {
        expect(info.called).to.equal(true);
        done();
      });
    });

    it('should set test interval and rety traversal if fail', function(done) {
      let clock = sandbox.useFakeTimers('setInterval');
      let listen = sandbox.stub().callsArg(1);
      let info = sandbox.stub();
      let warn = sandbox.stub();
      let node = {
        contact: { hostname: '127.0.0.1', port: 8080 },
        listen,
        logger: { info, warn }
      };
      let plugin = new TraversePlugin(node);
      let _testIfReachable = sandbox.stub(
        plugin,
        '_testIfReachable'
      ).callsArgWith(0, null, true);
      _testIfReachable.onCall(1).callsArgWith(0, null, false);
      let _execTraversalStrategies = sandbox.stub(
        plugin,
        '_execTraversalStrategies'
      ).callsArgWith(0, null, true);
      node.listen(8080, () => {
        expect(info.called).to.equal(true);
        expect(plugin._testInterval).to.not.equal(undefined);
        expect(_execTraversalStrategies.callCount).to.equal(1);
        clock.tick(1200000);
        expect(_execTraversalStrategies.callCount).to.equal(2);
        expect(warn.called).to.equal(true);
        done();
      });
    });

    after(() => sandbox.restore());

  });

});

describe('NATPMPStrategy', function() {

  describe('@method exec', function() {

    it('should create port mapping and get ip', function(done) {
      let { NATPMPStrategy } = proxyquire('../lib/plugin-traverse', {
        'nat-pmp': {
          connect: sinon.stub().returns({
            portMapping: sinon.stub().callsArg(1),
            externalIp: sinon.stub().callsArgWith(0, null, {
              ip: ['some', 'ip', 'addr']
            })
          })
        },
        network: {
          get_gateway_ip: sinon.stub().callsArgWith(
            0,
            null,
            'gateway.ip.addr'
          )
        }
      });
      let strategy = new NATPMPStrategy({ publicPort: 8081 });
      let node = { contact: { hostname: '127.0.0.1', port: 8080 }, logger };
      strategy.exec(node, (err) => {
        expect(err).to.equal(null);
        expect(node.contact.hostname).to.equal('some.ip.addr');
        expect(node.contact.port).to.equal(8081);
        done();
      });
    });

    it('should callback with error', function(done) {
      let { NATPMPStrategy } = proxyquire('../lib/plugin-traverse', {
        'nat-pmp': {
          connect: sinon.stub().returns({
            portMapping: sinon.stub().callsArg(1),
            externalIp: sinon.stub().callsArgWith(
              0,
              new Error('Failed to get IP')
            )
          })
        },
        network: {
          get_gateway_ip: sinon.stub().callsArgWith(
            0,
            null,
            'gateway.ip.addr'
          )
        }
      });
      let strategy = new NATPMPStrategy();
      let node = { contact: { hostname: '127.0.0.1', port: 8080 }, logger };
      strategy.exec(node, (err) => {
        expect(err.message).to.equal('Failed to get IP');
        done();
      });
    });

  });

});

describe('ReverseTunnelStrategy', function() {

  describe('@method exec', function() {

    it('should error if parse fails', function(done) {
      let { ReverseTunnelStrategy } = proxyquire('../lib/plugin-traverse', {
        http: {
          request: function(opts, handler) {
            let data = ['{', 'invalid', 'json'];
            handler(new stream.Readable({
              read: function() {
                this.push(data.shift() || null);
              }
            }));
            return stream.Writable({ write: () => null });
          }
        }
      });
      let strategy = new ReverseTunnelStrategy();
      strategy.exec({
        contact: { hostname: '127.0.0.1', port: 8080 },
        identity: Buffer.from('nodeid')
      }, (err) => {
        expect(err.message).to.equal('Failed to parse response');
        done();
      });
    });

    it('should error if status code not 200', function(done) {
      let { ReverseTunnelStrategy } = proxyquire('../lib/plugin-traverse', {
        http: {
          request: function(opts, handler) {
            let data = [JSON.stringify({ error: 'unknown' })];
            let response = new stream.Readable({
              read: function() {
                this.push(data.shift() || null);
              }
            });
            response.statusCode = 500;
            handler(response);
            return stream.Writable({ write: () => null });
          }
        }
      });
      let strategy = new ReverseTunnelStrategy();
      strategy.exec({
        contact: { hostname: '127.0.0.1', port: 8080 },
        identity: Buffer.from('nodeid')
      }, (err) => {
        expect(err.message).to.equal('unknown');
        done();
      });
    });

    it('should update the contact info', function(done) {
      let open = sinon.stub();
      let { ReverseTunnelStrategy } = proxyquire('../lib/plugin-traverse', {
        http: {
          request: function(opts, handler) {
            let data = [JSON.stringify({
              tunnelHost: 'diglet.me',
              tunnelPort: 12000,
              publicUrl: 'http://nodeid.diglet.me'
            })];
            let response = new stream.Readable({
              read: function() {
                this.push(data.shift() || null);
              }
            });
            response.statusCode = 200;
            handler(response);
            return stream.Writable({ write: () => null });
          }
        },
        diglet: {
          Tunnel: function(opts) {
            expect(opts.localAddress).to.equal('127.0.0.1');
            expect(opts.localPort).to.equal(8080);
            expect(opts.remoteAddress).to.equal('diglet.me');
            expect(opts.remotePort).to.equal(12000);
            return { open: open };
          }
        }
      });
      let strategy = new ReverseTunnelStrategy();
      let node = {
        contact: { hostname: '127.0.0.1', port: 8080 },
        identity: Buffer.from('nodeid')
      };
      strategy.exec(node, (err) => {
        expect(err).to.equal(undefined);
        expect(open.called).to.equal(true);
        expect(node.contact.hostname).to.equal('nodeid.diglet.me');
        expect(node.contact.port).to.equal(80);
        done();
      });
    });

  });

});

describe('UPNPStrategy', function() {

  describe('@method exec', function() {

    it('should create port mapping and get ip', function(done) {
      let strategy = new UPNPStrategy({ publicPort: 8081 });
      sinon.stub(strategy.client, 'portMapping').callsArg(1);
      sinon.stub(strategy.client, 'externalIp').callsArgWith(
        0,
        null,
        'some.ip.addr'
      );
      let node = { contact: { hostname: '127.0.0.1', port: 8080 } };
      strategy.exec(node, (err) => {
        expect(err).to.equal(null);
        expect(node.contact.port).to.equal(8081);
        expect(node.contact.hostname).to.equal('some.ip.addr');
        done();
      });
    });

    it('should callback with error', function(done) {
      let strategy = new UPNPStrategy();
      sinon.stub(strategy.client, 'portMapping').callsArg(1);
      sinon.stub(strategy.client, 'externalIp').callsArgWith(
        0,
        new Error('Failed to get IP')
      );
      let node = { contact: { hostname: '127.0.0.1', port: 8080 } };
      strategy.exec(node, (err) => {
        expect(err.message).to.equal('Failed to get IP');
        done();
      });
    });

  });

});
