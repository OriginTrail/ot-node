'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const kadence = require('..');
const { SpartacusPlugin } = require('../lib/plugin-spartacus');
const utils = require('../lib/utils');


describe('@module kadence/spartacus', function() {

  describe('@constructor', function() {

    it('should replace node identity and add transforms', function() {
      let id = utils.toPublicKeyHash('test');
      let node = {
        identity: id,
        rpc: {
          serializer: { append: sinon.stub() },
          deserializer: { prepend: sinon.stub() }
        },
        router: {},
        contact: {},
        use: sinon.stub()
      };
      let plugin = new SpartacusPlugin(node);
      expect(node.identity).to.equal(plugin.identity);
      expect(node.router.identity).to.equal(plugin.identity);
      expect(node.rpc.serializer.append.called).to.equal(true);
      expect(node.rpc.deserializer.prepend.called).to.equal(true);
    });

  });

  describe('@method serialize', function() {

    it('should add an AUTHENTICATE message to the payload', function(done) {
      let node = {
        identity: null,
        rpc: {
          serializer: { append: sinon.stub() },
          deserializer: { prepend: sinon.stub() }
        },
        router: {},
        contact: {},
        use: sinon.stub()
      };
      let plugin = new SpartacusPlugin(node);
      kadence.Messenger.JsonRpcSerializer([
        { method: 'PING', params: [] },
        [
          plugin.identity.toString('hex'),
          { hostname: 'localhost', port: 8080 }
        ],
        [
          utils.toPublicKeyHash('test').toString('hex'),
          { hostname: 'localhost', port: 8080}
        ]
      ], (err, data) => {
        plugin.serialize(data, null, (err, [, buffer]) => {
          let result = JSON.parse(buffer.toString());
          expect(result).to.have.lengthOf(3);
          expect(result[1].params[0]).to.equal(plugin.identity.toString('hex'));
          expect(result[2].params).to.have.lengthOf(3);
          done();
        });
      });
    });

  });

  describe('@method deserialize', function() {

    it('should callback error if id is not pubkeyhash', function(done) {
      let node = {
        identity: null,
        rpc: {
          serializer: { append: sinon.stub() },
          deserializer: { prepend: sinon.stub() }
        },
        router: {},
        contact: {},
        use: sinon.stub()
      };
      let plugin = new SpartacusPlugin(node);
      plugin.deserialize(Buffer.from(JSON.stringify([
        {
          jsonrpc: '2.0',
          id: 'test',
          method: 'PING',
          params: []
        },
        {
          jsonrpc: '2.0',
          method: 'IDENTIFY',
          params: [
            '0000ff',
            { hostname: 'localhost', port: 8080 }
          ]
        },
        {
          jsonrpc: '2.0',
          method: 'AUTHENTICATE',
          params: [
            plugin.publicKey.toString('hex'),
            '0000ff',
            [plugin.publicExtendedKey, plugin.derivationIndex]
          ]
        }
      ])), null, (err) => {
        expect(err.message).to.equal('Identity does not match public key');
        done();
      });
    });

    it('should callback error if invalid signature', function(done) {
      let node = {
        identity: null,
        rpc: {
          serializer: { append: sinon.stub() },
          deserializer: { prepend: sinon.stub() }
        },
        router: {},
        contact: {},
        use: sinon.stub()
      };
      let plugin = new SpartacusPlugin(node);
      plugin.deserialize(Buffer.from(JSON.stringify([
        {
          jsonrpc: '2.0',
          id: 'test',
          method: 'PING',
          params: []
        },
        {
          jsonrpc: '2.0',
          method: 'IDENTIFY',
          params: [
            plugin.identity.toString('hex'),
            { hostname: 'localhost', port: 8080 }
          ]
        },
        {
          jsonrpc: '2.0',
          method: 'AUTHENTICATE',
          params: [
            '583b0eb005a94f22410d2da645b62dc7cdd9288f7fece1fd67fd6d90f4ce0284' +
              '48d3fd353969dde8e9e73ad69178efda22008a4e642f32845e89c59ec83a68' +
              '8f',
            plugin.publicKey.toString('hex'),
            [plugin.publicExtendedKey, plugin.derivationIndex]
          ]
        }
      ])), null, (err) => {
        expect(err.message).to.equal('Message includes invalid signature');
        done();
      });
    });

    it('should callback error if invalid child', function(done) {
      let node = {
        identity: null,
        rpc: {
          serializer: { append: sinon.stub() },
          deserializer: { prepend: sinon.stub() }
        },
        router: {},
        contact: {},
        use: sinon.stub()
      };
      let plugin = new SpartacusPlugin(node);
      plugin.deserialize(Buffer.from(JSON.stringify([
        {
          jsonrpc: '2.0',
          id: 'test',
          method: 'PING',
          params: []
        },
        {
          jsonrpc: '2.0',
          method: 'IDENTIFY',
          params: [
            plugin.identity.toString('hex'),
            { hostname: 'localhost', port: 8080 }
          ]
        },
        {
          jsonrpc: '2.0',
          method: 'AUTHENTICATE',
          params: [
            '583b0eb005a94f22410d2da645b62dc7cdd9288f7fece1fd67fd6d90f4ce0284' +
              '48d3fd353969dde8e9e73ad69178efda22008a4e642f32845e89c59ec83a68' +
              '8f',
            plugin.publicKey.toString('hex'),
            [plugin.publicExtendedKey, 1]
          ]
        }
      ])), null, (err) => {
        expect(err.message).to.equal('Public key is not a valid child');
        done();
      });
    });

  });

});
