'use strict';

const { EventEmitter } = require('events');
const { expect } = require('chai');
const { stub } = require('sinon');
const proxyquire = require('proxyquire');


describe('@class UDPTransport', function() {

  describe('@constructor', function() {

    it('should add error listener to socket', function(done) {
      const socket = new EventEmitter();
      const FakeUDPTransport = proxyquire('../lib/transport-udp', {
        dgram: {
          createSocket: () => socket
        }
      });
      const udpTransport = new FakeUDPTransport();
      udpTransport.on('error', (err) => {
        expect(err.message).to.equal('Socket error');
        done();
      });
      setImmediate(() => socket.emit('error', new Error('Socket error')));
    });

  });

  describe('@private _write', function() {

    it('should send the buffer to the contact over the socket', function() {
      const socket = new EventEmitter();
      socket.send = stub();
      const FakeUDPTransport = proxyquire('../lib/transport-udp', {
        dgram: {
          createSocket: () => socket
        }
      });
      const udpTransport = new FakeUDPTransport();
      const message = Buffer.from('hello world');
      udpTransport.write([
        'message_id',
        message,
        [
          'identityKey',
          { hostname: 'localhost', port: 8080 }
        ]
      ]);
      expect(socket.send.calledWithMatch(
        message,
        0,
        message.length,
        8080,
        'localhost'
      )).to.equal(true);
    });

  });

  describe('@private _read', function() {

    it('should emit data for every message received', function(done) {
      const socket = new EventEmitter();
      const FakeUDPTransport = proxyquire('../lib/transport-udp', {
        dgram: {
          createSocket: () => socket
        }
      });
      const udpTransport = new FakeUDPTransport();
      let message = Buffer.from('hello world');
      let receivedMessages = 0;
      udpTransport.on('data', (buffer) => {
        receivedMessages++;
        expect(Buffer.compare(message, buffer)).to.equal(0);
        if (receivedMessages === 3) {
          done();
        }
      });
      setImmediate(() => {
        udpTransport.socket.emit('message', message);
        udpTransport.socket.emit('message', message);
        udpTransport.socket.emit('message', message);
      });
    });

  });

  describe('@method listen', function() {

    it('should call socket#bind', function() {
      const socket = new EventEmitter();
      socket.bind = stub();
      const FakeUDPTransport = proxyquire('../lib/transport-udp', {
        dgram: {
          createSocket: () => socket
        }
      });
      const udpTransport = new FakeUDPTransport();
      udpTransport.listen(8080, 'localhost');
      expect(socket.bind.calledWithMatch(8080, 'localhost')).to.equal(true);
    });

  });

});
