'use strict';

const { expect } = require('chai');
const jsonrpc = require('jsonrpc-lite');
const Messenger = require('../lib/messenger');


describe('@class Messenger', function() {

  describe('@property serializer', function() {

    it('should use the supplied serializer', function(done) {
      let messenger = new Messenger({
        serializer: (obj, cb) => cb(null, 'SERIALIZED')
      });
      messenger.serializer.once('data', (data) => {
        expect(data).to.equal('SERIALIZED');
        done();
      }).write({});
    });

    it('should bubble errors from the serializer', function(done) {
      let messenger = new Messenger();
      messenger.once('error', (err) => {
        expect(err.message).to.equal('Some error');
        done();
      });
      setImmediate(() => {
        messenger.serializer.emit('error', new Error('Some error'));
      });
    });

  });

  describe('@property deserializer', function() {

    it('should use the supplied deserializer', function(done) {
      let messenger = new Messenger({
        deserializer: (obj, cb) => cb(null, 'DESERIALIZED')
      });
      messenger.deserializer.once('data', (data) => {
        expect(data).to.equal('DESERIALIZED');
        done();
      }).write(Buffer.from('test'));
    });

    it('should emit error if bad data to deserialize', function(done) {
      let messenger = new Messenger({
        deserializer: (obj, cb) => cb(null, 'DESERIALIZED')
      });
      messenger.once('error', (err) => {
        expect(err.message).to.equal('Cannot deserialize non-buffer chunk');
        done();
      });
      setImmediate(() => messenger.deserializer.write({}));
    });

  });

});

describe('@static Messenger#JsonRpcSerializer', function() {

  it('should serialize the data as a json-rpc payload', function(done) {
    Messenger.JsonRpcSerializer([
      { method: 'TEST', params: ['test'] },
      ['SENDER', {}],
      { hostname: 'localhost', port: 8080 }
    ], (err, [id, buffer, receiver]) => {
      expect(typeof id).to.equal('string');
      expect(Buffer.isBuffer(buffer)).to.equal(true);
      let [message, identity] = jsonrpc.parse(buffer.toString());
      expect(message.payload.params[0]).to.equal('test');
      expect(identity.payload.params[0]).to.equal('SENDER');
      expect(receiver.hostname).to.equal('localhost');
      done();
    });
  });

  it('should callback error with invalid data', function(done) {
    Messenger.JsonRpcSerializer([
      { invalid: { data: 'object' } },
      { identity: 'SENDER' },
      { identity: 'RECEIVER' }
    ], (err) => {
      expect(err.message).to.equal('Invalid message type "invalid"');
      done();
    });
  });

});

describe('@static Messenger#JsonRpcDeserializer', function() {

  it('should deserialize the buffer as a json object', function(done) {
    Messenger.JsonRpcDeserializer(Buffer.from(JSON.stringify([
      { jsonrpc: '2.0', id: 'x', method: 'TEST', params: ['test'] },
      { jsonrpc: '2.0', method: 'IDENTIFY', params: ['SENDER', {}] }
    ])), (err, [message, contact]) => {
      expect(message.payload.params[0]).to.equal('test');
      expect(message.payload.id).to.equal('x');
      expect(message.payload.method).to.equal('TEST');
      expect(contact.payload.params[0]).to.equal('SENDER');
      done();
    });
  });

  it('should callback error with invalid data', function(done) {
    Messenger.JsonRpcDeserializer(Buffer.from(JSON.stringify([
      { invalid: { data: 'object' } },
      { jsonrpc: '2.0', method: 'IDENTIFY', params: ['SENDER', {}] }
    ])), (err) => {
      expect(err.message).to.equal('Invalid message type "invalid"');
      done();
    });
  });

});
