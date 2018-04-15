'use strict';

const { expect } = require('chai');
const { stub } = require('sinon');
const utils = require('../lib/utils');
const KademliaRules = require('../lib/rules-kademlia');


describe('@class KademliaRules', function() {

  describe('@method ping', function() {

    it('should respond with empty params', function(done) {
      let rules = new KademliaRules();
      rules.ping({
        id: 'message_id',
        method: 'PING',
        params: []
      }, {
        send: function(result) {
          expect(Array.isArray(result)).to.equal(true);
          expect(result).to.have.lengthOf(0);
          done();
        }
      });
    });

  });

  describe('@method store', function() {

    it('should pass to error handler if no item', function(done) {
      let rules = new KademliaRules();
      let send = stub();
      rules.store({
        id: 'message_id',
        method: 'STORE',
        params: [
          utils.getRandomKeyString()
        ]
      }, { send }, (err) => {
        expect(send.called).to.equal(false);
        expect(err.message).to.equal('Invalid storage item supplied');
        done();
      });
    });

    it('should pass to error handler if no timestamp', function(done) {
      let rules = new KademliaRules();
      let send = stub();
      rules.store({
        id: 'message_id',
        method: 'STORE',
        params: [
          utils.getRandomKeyString(),
          {
            timestamp: 'wednesday',
            publisher: utils.getRandomKeyString(),
            value: 'some string'
          }
        ]
      }, { send }, (err) => {
        expect(send.called).to.equal(false);
        expect(err.message).to.equal('Invalid timestamp supplied');
        done();
      });
    });

    it('should pass to error handler if invalid publisher', function(done) {
      let rules = new KademliaRules();
      let send = stub();
      rules.store({
        id: 'message_id',
        method: 'STORE',
        params: [
          utils.getRandomKeyString(),
          {
            timestamp: Date.now(),
            publisher: 'bookchin',
            value: 'some string'
          }
        ]
      }, { send }, (err) => {
        expect(send.called).to.equal(false);
        expect(err.message).to.equal('Invalid publisher identity supplied');
        done();
      });
    });

    it('should pass to error handler if invalid key', function(done) {
      let rules = new KademliaRules();
      let send = stub();
      rules.store({
        id: 'message_id',
        method: 'STORE',
        params: [
          'some key',
          {
            timestamp: Date.now(),
            publisher: utils.getRandomKeyString(),
            value: 'some string'
          }
        ]
      }, { send }, (err) => {
        expect(send.called).to.equal(false);
        expect(err.message).to.equal('Invalid item key supplied');
        done();
      });
    });

    it('should pass to error handler if undefined value', function(done) {
      let rules = new KademliaRules();
      let send = stub();
      rules.store({
        id: 'message_id',
        method: 'STORE',
        params: [
          utils.getRandomKeyString(),
          {
            timestamp: Date.now(),
            publisher: utils.getRandomKeyString(),
            value: undefined
          }
        ]
      }, { send }, (err) => {
        expect(send.called).to.equal(false);
        expect(err.message).to.equal('Invalid item value supplied');
        done();
      });
    });

    it('should pass to error handler if store fail', function(done) {
      let rules = new KademliaRules({
        storage: {
          put: stub().callsArgWith(3, new Error('Failed to store item'))
        }
      });
      let send = stub();
      rules.store({
        id: 'message_id',
        method: 'STORE',
        params: [
          utils.getRandomKeyString(),
          {
            timestamp: Date.now(),
            publisher: utils.getRandomKeyString(),
            value: 'some string'
          }
        ]
      }, { send }, (err) => {
        expect(send.called).to.equal(false);
        expect(err.message).to.equal('Failed to store item');
        done();
      });
    });

    it('should echo back arguments if stored', function(done) {
      let rules = new KademliaRules({
        storage: {
          put: stub().callsArgWith(3, null)
        }
      });
      let key = utils.getRandomKeyString();
      let timestamp = Date.now();
      let publisher = utils.getRandomKeyString();
      let value = 'some string';
      rules.store({
        id: 'message_id',
        method: 'STORE',
        params: [
          key,
          { timestamp, publisher, value }
        ]
      }, {
        send: (result) => {
          expect(result[0]).to.equal(key);
          expect(result[1].timestamp).to.equal(timestamp);
          expect(result[1].publisher).to.equal(publisher);
          expect(result[1].value).to.equal(value);
          done();
        }
      });
    });

  });

  describe('@method findNode', function() {

    it('should pass to error handler if invalid key', function(done) {
      let rules = new KademliaRules();
      let send = stub();
      rules.findNode({
        id: 'message_id',
        method: 'FIND_NODE',
        params: ['invalid key']
      }, { send }, (err) => {
        expect(send.called).to.equal(false);
        expect(err.message).to.equal('Invalid lookup key supplied');
        done();
      });
    });

    it('should send result router#getClosestContactsToKey', function(done) {
      let contacts = new Map();
      contacts.set('node id', { hostname: 'localhost', port: 8080 });
      let rules = new KademliaRules({
        router: {
          getClosestContactsToKey: () => contacts
        }
      });
      rules.findNode({
        id: 'message_id',
        method: 'FIND_NODE',
        params: [utils.getRandomKeyString()]
      }, {
        send: (result) => {
          expect(Array.isArray(result)).to.equal(true);
          expect(result[0][0]).to.equal('node id');
          expect(result[0][1].hostname).to.equal('localhost');
          expect(result[0][1].port).to.equal(8080);
          done();
        }
      });
    });

  });

  describe('@method findValue', function() {

    it('should pass to error handler if invalid key', function(done) {
      let rules = new KademliaRules();
      let send = stub();
      rules.findValue({
        id: 'message_id',
        method: 'FIND_VALUE',
        params: ['invalid key']
      }, { send }, (err) => {
        expect(send.called).to.equal(false);
        expect(err.message).to.equal('Invalid lookup key supplied');
        done();
      });
    });

    it('should call findNode if item not found', function(done) {
      let contacts = new Map();
      contacts.set('node id', { hostname: 'localhost', port: 8080 });
      let rules = new KademliaRules({
        storage: {
          get: stub().callsArgWith(2, new Error('Not found'))
        },
        router: {
          getClosestContactsToKey: stub().returns(contacts)
        }
      });
      rules.findValue({
        id: 'message_id',
        method: 'FIND_VALUE',
        params: [utils.getRandomKeyString()]
      }, {
        send: (result) => {
          expect(Array.isArray(result)).to.equal(true);
          expect(result[0][0]).to.equal('node id');
          expect(result[0][1].hostname).to.equal('localhost');
          expect(result[0][1].port).to.equal(8080);
          done();
        }
      });
    });

    it('should respond with the item if found', function(done) {
      let item = {
        timestamp: Date.now(),
        publisher: utils.getRandomKeyString(),
        value: 'some string'
      };
      let rules = new KademliaRules({
        storage: {
          get: stub().callsArgWith(2, null, item)
        }
      });
      rules.findValue({
        id: 'message_id',
        method: 'FIND_VALUE',
        params: [utils.getRandomKeyString()]
      }, {
        send: (result) => {
          expect(result).to.equal(item);
          done();
        }
      });
    });

  });

});
