'use strict';

const { Readable: ReadableStream } = require('stream');
const { expect } = require('chai');
const sinon = require('sinon');
const utils = require('../lib/utils');
const KademliaNode = require('../lib/node-kademlia');
const FakeTransport = require('./fixtures/transport-fake');
const levelup = require('levelup');
const memdown = require('memdown');
const storage = levelup('test:node-kademlia', memdown);
const bunyan = require('bunyan');
const constants = require('../lib/constants');


describe('@class KademliaNode', function() {

  this.timeout(12000)

  let logger, transport, kademliaNode, clock;

  before(() => {
    clock = sinon.useFakeTimers(Date.now(), 'setInterval');
    logger = bunyan.createLogger({
      name: 'test:node-abstract:unit',
      level: 'fatal'
    });
    transport = new FakeTransport();
    kademliaNode = new KademliaNode({
      contact: { name: 'test:node-kademlia:unit' },
      storage,
      transport,
      logger,
      identity: Buffer.from('aa48d3f07a5241291ed0b4cab6483fa8b8fcc128', 'hex')
    });
  });

  describe('@private _updateContact', function() {

    it('should add the contact to the routing table', function(done) {
      let contact = { hostname: 'localhost', port: 8080 }
      kademliaNode._updateContact(
        'ea48d3f07a5241291ed0b4cab6483fa8b8fcc128',
        contact
      );
      setImmediate(() => {
        expect(kademliaNode.router.getContactByNodeId(
          'ea48d3f07a5241291ed0b4cab6483fa8b8fcc128'
        )).to.equal(contact);
        done();
      });
    });

    it('should not add itself to the routing table', function() {
      let contact = { hostname: 'localhost', port: 8080 }
      kademliaNode._updateContact(
        'aa48d3f07a5241291ed0b4cab6483fa8b8fcc128',
        contact
      );
      expect(kademliaNode.router.getContactByNodeId(
        'aa48d3f07a5241291ed0b4cab6483fa8b8fcc128'
      )).to.equal(undefined);
    });

    it('should replace the head contact if ping fails', function(done) {
      let bucketIndex = kademliaNode.router.indexOf(
        'ea48d3f07a5241291ed0b4cab6483fa8b8fcc128'
      );
      let addContactByNodeId = sinon.stub(
        kademliaNode.router,
        'addContactByNodeId'
      );
      addContactByNodeId.onCall(0).returns(
        [bucketIndex, kademliaNode.router.get(bucketIndex), -1]
      );
      addContactByNodeId.onCall(1).returns(
        [bucketIndex, kademliaNode.router.get(bucketIndex), 0]
      );
      let ping = sinon.stub(kademliaNode, 'ping').callsArgWith(
        1,
        new Error('Timeout')
      );
      let removeContactByNodeId = sinon.stub(
        kademliaNode.router,
        'removeContactByNodeId'
      );
      kademliaNode._updateContact('ea48d3f07a5241291ed0b4cab6483fa8b8fcc128',
                                  { hostname: 'localhost', port: 8080 });
      setImmediate(() => {
        addContactByNodeId.restore();
        ping.restore();
        removeContactByNodeId.restore();
        expect(addContactByNodeId.callCount).to.equal(2);
        expect(removeContactByNodeId.callCount).to.equal(1);
        done();
      });
    });

    it('should do nothing if the head contact responds', function(done) {
      let bucketIndex = kademliaNode.router.indexOf(
        'ea48d3f07a5241291ed0b4cab6483fa8b8fcc128'
      );
      let addContactByNodeId = sinon.stub(
        kademliaNode.router,
        'addContactByNodeId'
      );
      addContactByNodeId.onCall(0).returns(
        [bucketIndex, kademliaNode.router.get(bucketIndex), -1]
      );
      addContactByNodeId.onCall(1).returns(
        [bucketIndex, kademliaNode.router.get(bucketIndex), 0]
      );
      let ping = sinon.stub(kademliaNode, 'ping').callsArg(1);
      let removeContactByNodeId = sinon.stub(
        kademliaNode.router,
        'removeContactByNodeId'
      );
      kademliaNode._updateContact('ea48d3f07a5241291ed0b4cab6483fa8b8fcc128',
                                  { hostname: 'localhost', port: 8080 });
      setImmediate(() => {
        addContactByNodeId.restore();
        ping.restore();
        removeContactByNodeId.restore();
        expect(addContactByNodeId.callCount).to.equal(1);
        expect(removeContactByNodeId.callCount).to.equal(0);
        done();
      });
    });

  });

  describe('@method listen', function() {

    it('should use kad rules and setup refresh/replicate', function(done) {
      let sandbox = sinon.sandbox.create();
      let use = sandbox.stub(kademliaNode, 'use');
      let refresh = sandbox.stub(kademliaNode, 'refresh');
      let replicate = sandbox.stub(kademliaNode, 'replicate').callsArg(0);
      let expire = sandbox.stub(kademliaNode, 'expire');
      sandbox.stub(transport, 'listen');
      kademliaNode.listen();
      clock.tick(constants.T_REPLICATE);
      setImmediate(() => {
        sandbox.restore();
        expect(use.calledWithMatch('PING')).to.equal(true);
        expect(use.calledWithMatch('STORE')).to.equal(true);
        expect(use.calledWithMatch('FIND_NODE')).to.equal(true);
        expect(use.calledWithMatch('FIND_VALUE')).to.equal(true);
        expect(refresh.calledWithMatch(0)).to.equal(true);
        expect(replicate.callCount).to.equal(1);
        expect(expire.callCount).to.equal(1);
        done();
      });
    });

  });

  describe('@method join', function() {

    it('should insert contact, lookup, and refresh buckets', function(done) {
      let addContactByNodeId = sinon.stub(
        kademliaNode.router,
        'addContactByNodeId'
      );
      let iterativeFindNode = sinon.stub(
        kademliaNode,
        'iterativeFindNode'
      ).callsFake(function(p, cb) {
        addContactByNodeId.restore();
        kademliaNode.router.addContactByNodeId(
          'da48d3f07a5241291ed0b4cab6483fa8b8fcc128',
          {}
        );
        kademliaNode.router.addContactByNodeId(
          'ca48d3f07a5241291ed0b4cab6483fa8b8fcc128',
          {}
        );
        kademliaNode.router.addContactByNodeId(
          'ba48d3f07a5241291ed0b4cab6483fa8b8fcc128',
          {}
        );
        cb();
      });
      let getClosestBucket = sinon.stub(
        kademliaNode.router,
        'getClosestBucket'
      ).returns([constants.B - 1, kademliaNode.router.get(constants.B - 1)]);
      let refresh = sinon.stub(kademliaNode, 'refresh').callsArg(1);
      kademliaNode.join(['ea48d3f07a5241291ed0b4cab6483fa8b8fcc128', {
        hostname: 'localhost',
        port: 8080
      }], (err) => {
        kademliaNode.router.removeContactByNodeId(
          'da48d3f07a5241291ed0b4cab6483fa8b8fcc128'
        );
        kademliaNode.router.removeContactByNodeId(
          'ca48d3f07a5241291ed0b4cab6483fa8b8fcc128'
        );
        kademliaNode.router.removeContactByNodeId(
          'ba48d3f07a5241291ed0b4cab6483fa8b8fcc128'
        );
        iterativeFindNode.restore();
        getClosestBucket.restore();
        refresh.restore();
        expect(err).to.equal(undefined);
        expect(addContactByNodeId.calledWithMatch(
          'ea48d3f07a5241291ed0b4cab6483fa8b8fcc128'
        )).to.equal(true);
        expect(iterativeFindNode.calledWithMatch(
          kademliaNode.identity.toString('hex')
        )).to.equal(true);
        expect(refresh.callCount).to.equal(1);
        done();
      });
    });

    it('should error if lookup fails', function(done) {
      let addContactByNodeId = sinon.stub(
        kademliaNode.router,
        'addContactByNodeId'
      );
      let iterativeFindNode = sinon.stub(
        kademliaNode,
        'iterativeFindNode'
      ).callsArgWith(1, new Error('Lookup failed'));
      let getClosestBucket = sinon.stub(
        kademliaNode.router,
        'getClosestBucket'
      ).returns([constants.B - 1, kademliaNode.router.get(constants.B - 1)]);
      let refresh = sinon.stub(kademliaNode, 'refresh').callsArg(1);
      kademliaNode.join(['ea48d3f07a5241291ed0b4cab6483fa8b8fcc128', {
        hostname: 'localhost',
        port: 8080
      }], (err) => {
        addContactByNodeId.restore();
        iterativeFindNode.restore();
        getClosestBucket.restore();
        refresh.restore();
        expect(err.message).to.equal('Lookup failed');
        expect(addContactByNodeId.calledWithMatch(
          'ea48d3f07a5241291ed0b4cab6483fa8b8fcc128'
        )).to.equal(true);
        expect(iterativeFindNode.calledWithMatch(
          kademliaNode.identity.toString('hex')
        )).to.equal(true);
        expect(refresh.callCount).to.equal(0);
        done();
      });
    });

  });

  describe('@method ping', function() {

    it('should call send with PING message', function(done) {
      let send = sinon.stub(kademliaNode, 'send').callsFake((a, b, c, d) => {
        setTimeout(d, 10);
      });
      let contact = ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc128', {
        hostname: 'localhost',
        port: 8080
      }];
      kademliaNode.ping(contact, (err, latency) => {
        send.restore();
        expect(send.calledWithMatch('PING', [], contact)).to.equal(true);
        expect(latency > 0).to.equal(true);
        done();
      });
    });

  });

  describe('@method iterativeStore', function() {

    it('should send store rpc to found contacts and keep copy', function(done) {
      let sandbox = sinon.sandbox.create();
      let contact = { hostname: 'localhost', port: 8080 };
      sandbox.stub(
        kademliaNode,
        'iterativeFindNode'
      ).callsArgWith(
        1,
        null,
        Array(20).fill(null).map(() => [utils.getRandomKeyString(), contact])
      );
      let send = sandbox.stub(kademliaNode, 'send').callsArgWith(3, null);
      send.onCall(4).callsArgWith(3, new Error('Failed to store'));
      let put = sandbox.stub(kademliaNode.storage, 'put').callsArg(3);
      kademliaNode.iterativeStore(
        utils.getRandomKeyString(),
        'some storage item data',
        (err, stored) => {
          sandbox.restore();
          expect(stored).to.equal(19);
          expect(send.callCount).to.equal(20);
          expect(put.callCount).to.equal(1);
          done();
        }
      );
    });

    it('should send the store rpc with the existing metadata', function(done) {
      let sandbox = sinon.sandbox.create();
      let contact = { hostname: 'localhost', port: 8080 };
      sandbox.stub(
        kademliaNode,
        'iterativeFindNode'
      ).callsArgWith(
        1,
        null,
        Array(20).fill(null).map(() => [utils.getRandomKeyString(), contact])
      );
      let send = sandbox.stub(kademliaNode, 'send').callsArgWith(3, null);
      send.onCall(4).callsArgWith(3, new Error('Failed to store'));
      let put = sandbox.stub(kademliaNode.storage, 'put').callsArg(3);
      kademliaNode.iterativeStore(
        utils.getRandomKeyString(),
        {
          value: 'some storage item data',
          publisher: 'ea48d3f07a5241291ed0b4cab6483fa8b8fcc127',
          timestamp: Date.now()
        },
        (err, stored) => {
          sandbox.restore();
          expect(send.args[0][1][1].publisher).to.equal(
            'ea48d3f07a5241291ed0b4cab6483fa8b8fcc127'
          );
          expect(stored).to.equal(19);
          expect(send.callCount).to.equal(20);
          expect(put.callCount).to.equal(1);
          done();
        }
      );
    });

  });

  describe('@method iterativeFindNode', function() {

    it('should send iterative FIND_NODE calls', function(done) {
      let contact = { hostname: 'localhost', port: 8080 };
      let getClosestContactsToKey = sinon.stub(
        kademliaNode.router,
        'getClosestContactsToKey'
      ).returns([
        ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc127', contact],
        ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc128', contact],
        ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc129', contact]
      ]);
      let _updateContact = sinon.stub(kademliaNode, '_updateContact');
      let send = sinon.stub(kademliaNode, 'send');
      let contacts = Array(20).fill(null).map(() => {
        return [utils.getRandomKeyString(), contact]
      });
      send.onCall(0).callsArgWith(
        3,
        null,
        contacts
      );
      send.onCall(1).callsArgWith(
        3,
        new Error('Lookup failed')
      );
      send.onCall(2).callsArgWith(
        3,
        null,
        contacts
      );
      for (var i=0; i<20; i++) {
        send.onCall(i + 3).callsArgWith(
          3,
          new Error('Lookup failed')
        );
      }
      kademliaNode.iterativeFindNode(
        'ea48d3f07a5241291ed0b4cab6483fa8b8fcc126',
        (err, results) => {
          getClosestContactsToKey.restore();
          _updateContact.restore();
          send.restore();
          expect(err).to.equal(null);
          expect(send.callCount).to.equal(23);
          expect(_updateContact.callCount).to.equal(20);
          expect(results).to.have.lengthOf(2);
          results.forEach(([key, c]) => {
            expect(utils.keyStringIsValid(key)).to.equal(true);
            expect(contact).to.equal(c);
          });
          done();
        }
      );
    });

    it('should iterate through closer nodes', function(done) {
      let contact = { hostname: 'localhost', port: 8080 };
      let getClosestContactsToKey = sinon.stub(
        kademliaNode.router,
        'getClosestContactsToKey'
      ).returns([
        ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc125', contact],
        ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc128', contact],
        ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc129', contact]
      ]);
      let _updateContact = sinon.stub(kademliaNode, '_updateContact');
      let send = sinon.stub(kademliaNode, 'send');
      send.callsArgWith(
        3,
        null,
        Array(20).fill(null).map(() => {
          return [utils.getRandomKeyString(), contact]
        })
      );
      send.onCall(0).callsArgWith(
        3,
        null,
        [['ea48d3f07a5241291ed0b4cab6483fa8b8fcc127', contact]].concat(
          Array(20).fill(null).map(() => {
            return [utils.getRandomKeyString(), contact]
          })
        )
      )
      kademliaNode.iterativeFindNode(
        'ea48d3f07a5241291ed0b4cab6483fa8b8fcc126',
        (err, results) => {
          getClosestContactsToKey.restore();
          _updateContact.restore();
          send.restore();
          expect(err).to.equal(null);
          expect(results).to.have.lengthOf(constants.K);
          expect(results[0][0]).to.equal(
            'ea48d3f07a5241291ed0b4cab6483fa8b8fcc127'
          );
          expect(results[1][0]).to.equal(
            'ea48d3f07a5241291ed0b4cab6483fa8b8fcc125'
          );
          done();
        }
      );
    });

    it('should call each node a maximum of once', function(done) {
      let contact = { hostname: 'localhost', port: 8080 };
      let getClosestContactsToKey = sinon.stub(
        kademliaNode.router,
        'getClosestContactsToKey'
      ).returns([
        ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc125', contact],
        ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc128', contact],
        ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc129', contact]
      ]);
      let _updateContact = sinon.stub(kademliaNode, '_updateContact');
      let send = sinon.stub(kademliaNode, 'send');
      send.callsArgWith(
        3,
        null,
        Array(20).fill(null).map(() => {
          return [utils.getRandomKeyString(), contact]
        })
      );
      kademliaNode.iterativeFindNode(
        'ea48d3f07a5241291ed0b4cab6483fa8b8fcc126',
        () => {
          let sentNodes = send.args.map( args => args[2][0]);
          expect(sentNodes).to.deep.equal(sentNodes.filter(
            (value, index, self) => {
              return self.indexOf(value) === index;
            })
          )
          getClosestContactsToKey.restore();
          _updateContact.restore();
          send.restore();
          done();
        }
      );
    });

    it('should not include inactive nodes in the result', function(done) {
      let contact = { hostname: 'localhost', port: 8080 };
      let getClosestContactsToKey = sinon.stub(
        kademliaNode.router,
        'getClosestContactsToKey'
      ).returns([
        ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc127', contact],
        ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc128', contact],
        ['ea48d3f07a5241291ed0b4cab6483fa8b8fcc129', contact]
      ]);
      let _updateContact = sinon.stub(kademliaNode, '_updateContact');
      let send = sinon.stub(kademliaNode, 'send');
      let contacts = Array(20).fill(null).map(() => {
        return [utils.getRandomKeyString(), contact]
      });
      send.onCall(0).callsArgWith(
        3,
        null,
        contacts
      );
      send.onCall(1).callsArgWith(
        3,
        new Error('Lookup failed')
      );
      send.onCall(2).callsArgWith(
        3,
        null,
        contacts
      );
      for (var i=0; i<20; i++) {
        send.onCall(i + 3).callsArgWith(
          3,
          contacts
        );
      }
      kademliaNode.iterativeFindNode(
        'ea48d3f07a5241291ed0b4cab6483fa8b8fcc126',
        (err, results) => {
          getClosestContactsToKey.restore();
          _updateContact.restore();
          send.restore();
          expect(err).to.equal(null);
          results.forEach(([key]) => {
            expect(key).to.not.equal('ea48d3f07a5241291ed0b4cab6483fa8b8fcc128')
          });
          done();
        }
      );
    });
  });

  describe('@method iterativeFindValue', function() {

    it('should return a node list if no value is found', function(done) {
      let sandbox = sinon.sandbox.create();
      let contact = { hostname: 'localhost', port: 8080 };
      sandbox.stub(
        kademliaNode.router,
        'getClosestContactsToKey'
      ).returns(new Map(Array(20).fill(null).map(() => [
        utils.getRandomKeyString(),
        contact
      ])));
      sandbox.stub(kademliaNode, 'send').callsArgWith(
        3,
        null,
        Array(20).fill(20).map(() => [utils.getRandomKeyString(), contact])
      );
      kademliaNode.iterativeFindValue(
        utils.getRandomKeyString(),
        (err, result) => {
          sandbox.restore();
          expect(Array.isArray(result)).to.equal(true);
          expect(result).to.have.lengthOf(constants.K);
          done();
        }
      );
    });

    it('should find a value at a currently unknown node', function(done) {
      let sandbox = sinon.sandbox.create();
      let contact = { hostname: 'localhost', port: 8080 };
      sandbox.stub(
        kademliaNode.router,
        'getClosestContactsToKey'
      ).returns(new Map(Array(10).fill(null).map(() => [
        utils.getRandomKeyString(),
        contact
      ])));
      let send = sandbox.stub(kademliaNode, 'send').callsArgWith(
        3,
        null,
        Array(20).fill(null).map(() => {
          return [utils.getRandomKeyString(), contact]
        })
      );
      send.onCall(10).callsArgWith(3, null, {
        value: 'some data value',
        timestamp: Date.now(),
        publisher: 'ea48d3f07a5241291ed0b4cab6483fa8b8fcc127'
      });
      kademliaNode.iterativeFindValue(
        utils.getRandomKeyString(),
        (err, result) => {
          sandbox.restore();
          expect(result.value).to.equal('some data value');
          done();
        }
      );
    });

    it('should store the value at the closest missing node', function(done) {
      let sandbox = sinon.sandbox.create();
      let contact = { hostname: 'localhost', port: 8080 };
      sandbox.stub(
        kademliaNode.router,
        'getClosestContactsToKey'
      ).returns(new Map(Array(20).fill(null).map(() => [
        utils.getRandomKeyString(),
        contact
      ])));
      let send = sandbox.stub(kademliaNode, 'send').callsArgWith(
        3,
        null,
        Array(20).fill(20).map(() => [utils.getRandomKeyString(), contact])
      );
      send.onCall(4).callsArgWith(3, null, {
        value: 'some data value',
        timestamp: Date.now(),
        publisher: 'ea48d3f07a5241291ed0b4cab6483fa8b8fcc127'
      });
      kademliaNode.iterativeFindValue(
        utils.getRandomKeyString(),
        (err, result) => {
          sandbox.restore();
          expect(result.value).to.equal('some data value');
          expect(send.callCount).to.equal(6);
          done();
        }
      );
    });

    it('should immediately callback if value found', function(done) {
      let sandbox = sinon.sandbox.create();
      let contact = { hostname: 'localhost', port: 8080 };
      sandbox.stub(
        kademliaNode.router,
        'getClosestContactsToKey'
      ).returns(new Map(Array(20).fill(null).map(() => [
        utils.getRandomKeyString(),
        contact
      ])));
      let send = sandbox.stub(kademliaNode, 'send').callsArgWith(3, null, {
        value: 'some data value',
        timestamp: Date.now(),
        publisher: 'ea48d3f07a5241291ed0b4cab6483fa8b8fcc127'
      });
      send.onCall(0).callsArgWith(3, new Error('Request timeout'));
      kademliaNode.iterativeFindValue(
        utils.getRandomKeyString(),
        (err, result) => {
          sandbox.restore();
          expect(result.value).to.equal('some data value');
          expect(send.callCount).to.equal(3);
          done();
        }
      );
    });

  });

  describe('@method replicate', function() {

    it('should replicate and republish the correct items', function(done) {
      let sandbox = sinon.sandbox.create();
      let items = [
        {
          key: utils.getRandomKeyString(),
          value: {
            value: 'some value',
            timestamp: Date.now() - constants.T_REPUBLISH,
            publisher: kademliaNode.identity.toString('hex')
          }
        },
        {
          key: utils.getRandomKeyString(),
          value: {
            value: 'some value',
            timestamp: Date.now() - constants.T_REPLICATE,
            publisher: utils.getRandomKeyString()
          }
        },
        {
          key: utils.getRandomKeyString(),
          value: {
            value: 'some value',
            timestamp: Date.now() - 1000,
            publisher: utils.getRandomKeyString()
          }
        }
      ];
      sandbox.stub(
        kademliaNode.storage,
        'createReadStream'
      ).returns(new ReadableStream({
        objectMode: true,
        read: function() {
          if (items.length) {
            this.push(items.shift());
          } else {
            this.push(null);
          }
        }
      }));
      let iterativeStore = sandbox.stub(kademliaNode, 'iterativeStore')
                             .callsArg(2);
      kademliaNode.replicate((err) => {
        sandbox.restore();
        expect(err).to.equal(undefined);
        expect(iterativeStore.callCount).to.equal(2);
        done();
      });
    });

  });

  describe('@method expire', function() {

    it('should expire the correct items', function(done) {
      let sandbox = sinon.sandbox.create();
      let items = [
        {
          key: utils.getRandomKeyString(),
          value: {
            value: 'some value',
            timestamp: Date.now() - constants.T_EXPIRE,
            publisher: kademliaNode.identity.toString('hex')
          }
        },
        {
          key: utils.getRandomKeyString(),
          value: {
            value: 'some value',
            timestamp: Date.now() - constants.T_EXPIRE,
            publisher: utils.getRandomKeyString()
          }
        },
        {
          key: utils.getRandomKeyString(),
          value: {
            value: 'some value',
            timestamp: Date.now() - 1000,
            publisher: utils.getRandomKeyString()
          }
        }
      ];
      sandbox.stub(
        kademliaNode.storage,
        'createReadStream'
      ).returns(new ReadableStream({
        objectMode: true,
        read: function() {
          if (items.length) {
            this.push(items.shift());
          } else {
            this.push(null);
          }
        }
      }));
      let del = sandbox.stub(
        kademliaNode.storage,
        'del'
      ).callsArg(1);
      kademliaNode.expire((err) => {
        sandbox.restore();
        expect(err).to.equal(undefined);
        expect(del.callCount).to.equal(2);
        done();
      });
    });

  });

  describe('@method refresh', function() {

    it('should refresh the correct buckets', function(done) {
      let sandbox = sinon.sandbox.create();
      let iterativeFindNode = sandbox.stub(
        kademliaNode,
        'iterativeFindNode'
      ).callsArg(1);
      kademliaNode.router.get(0).set(
        utils.getRandomKeyString(),
        { hostname: 'localhost', port: 8080 }
      );
      kademliaNode.router.get(2).set(
        utils.getRandomKeyString(),
        { hostname: 'localhost', port: 8080 }
      );
      for (var i=0; i<constants.B; i++) {
        kademliaNode._lookups.set(i, Date.now());
      }
      kademliaNode._lookups.set(1, Date.now() - constants.T_REFRESH);
      kademliaNode._lookups.set(2, Date.now() - constants.T_REFRESH);
      kademliaNode.refresh(0, () => {
        sandbox.restore();
        expect(iterativeFindNode.callCount).to.equal(2);
        done();
      });
    });

  });

});
