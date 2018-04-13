'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const uuid = require('uuid');
const utils = require('../lib/utils');
const RoutingTable = require('../lib/routing-table');
const kadence = require('..');
const constants = require('../lib/constants');
const BloomFilter = require('atbf');
const { QuasarPlugin, QuasarRules } = require('../lib/plugin-quasar');


describe('@module kadence/quasar', function() {

  describe('@class QuasarPlugin', function() {

    const logger = {
      warn: sinon.stub(),
      info: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub()
    };
    const identity = kadence.utils.getRandomKeyBuffer();
    const router = new kadence.RoutingTable(identity);
    const use = sinon.stub();

    before(function() {
      let numContacts = 32;

      while (numContacts > 0) {
        router.addContactByNodeId(kadence.utils.getRandomKeyString(), {
          hostname: 'localhost',
          port: 8080
        });
        numContacts--;
      }
    });

    describe('@constructor', function() {

      it('should add middleware, self to filter, decorate node', function() {
        let plugin = new QuasarPlugin({ identity, router, use });
        expect(use.callCount).to.equal(3);
        expect(
          use.calledWithMatch(QuasarPlugin.PUBLISH_METHOD)
        ).to.equal(true);
        expect(
          use.calledWithMatch(QuasarPlugin.SUBSCRIBE_METHOD)
        ).to.equal(true);
        expect(use.calledWithMatch(QuasarPlugin.UPDATE_METHOD)).to.equal(true);
        expect(plugin.filter[0].has(identity.toString('hex'))).to.equal(true);
        use.reset();
      });

    });

    describe('@property neighbors', function() {

      it('should return ALPHA contact objects', function() {
        let plugin = new QuasarPlugin({ identity, router, use });
        expect(plugin.neighbors).to.have.lengthOf(kadence.constants.ALPHA);
      });

    });

    describe('@method quasarPublish', function() {

      it('should node#send to each neighbor', function(done) {
        let plugin = new QuasarPlugin({ identity, router, use });
        plugin.node.send = sinon.stub().callsArg(3);
        plugin.quasarPublish('topic string', {
          some: 'data'
        }, () => {
          expect(plugin.node.send.callCount).to.equal(3);
          expect(
            plugin.node.send.calledWithMatch(QuasarPlugin.PUBLISH_METHOD)
          ).to.equal(true);
          let content = plugin.node.send.args[0][1];
          expect(typeof content.uuid).to.equal('string');
          expect(content.topic).to.equal('topic string');
          expect(content.contents.some).to.equal('data');
          expect(content.ttl).to.equal(constants.MAX_RELAY_HOPS);
          expect(content.publishers.indexOf(
            identity.toString('hex')
          )).to.equal(0);
          done();
        });
      });

      it('should use the routing key if supplied', function(done) {
        let plugin = new QuasarPlugin({ identity, router, use });
        let getClosestContactsToKey = sinon.spy(
          router,
          'getClosestContactsToKey'
        );
        let routingKey = kadence.utils.getRandomKeyString();
        plugin.node.send = sinon.stub().callsArg(3);
        plugin.quasarPublish('topic string', {
          some: 'data'
        }, { routingKey }, () => {
          expect(getClosestContactsToKey.calledWithMatch(
            routingKey
          )).to.equal(true);
          done();
        });
      });

    });

    describe('@method quasarSubscribe', function() {

      it('should add a topic subscription + refresh filters', function(done) {
        let plugin = new QuasarPlugin({ identity, router, use });
        let pullFilters = sinon.stub(plugin, 'pullFilters').callsArg(0);
        let pushFilters = sinon.stub(plugin, 'pushFilters');
        plugin.quasarSubscribe('single topic', true);
        setImmediate(() => {
          expect(plugin.filter[0].has('single topic')).to.equal(true);
          expect(plugin.groups.has('single topic')).to.equal(true);
          expect(pushFilters.called).to.equal(true);
          expect(pullFilters.called).to.equal(true);
          done();
        });
      });

      it('should add a topic subscription + refresh filters', function(done) {
        let plugin = new QuasarPlugin({ identity, router, use });
        let pullFilters = sinon.stub(plugin, 'pullFilters').callsArg(0);
        let pushFilters = sinon.stub(plugin, 'pushFilters');
        plugin.quasarSubscribe(['multi topic 1', 'multi topic 2'], true);
        setImmediate(() => {
          expect(plugin.filter[0].has('multi topic 1')).to.equal(true);
          expect(plugin.filter[0].has('multi topic 2')).to.equal(true);
          expect(plugin.groups.has('multi topic 1')).to.equal(true);
          expect(plugin.groups.has('multi topic 2')).to.equal(true);
          expect(pushFilters.called).to.equal(true);
          expect(pullFilters.called).to.equal(true);
          done();
        });
      });

    });

    describe('@method pullFilters', function() {

      it('should callback early if updated within an hour', function(done) {
        let plugin = new QuasarPlugin({ identity, router, use });
        let pullFilterFrom = sinon.stub(plugin, 'pullFilterFrom').callsArg(1);
        plugin._lastUpdate = Date.now();
        plugin.pullFilters(() => {
          expect(pullFilterFrom.callCount).to.equal(0);
          done();
        });
      });

      it('should bubble errors from pulling the filter', function(done) {
        let plugin = new QuasarPlugin({ identity, router, use, logger });
        sinon.stub(plugin, 'pullFilterFrom').callsArgWith(
          1,
          new Error('Request timed out')
        );
        plugin.pullFilters((err) => {
          expect(logger.warn.called).to.equal(true);
          logger.warn.reset();
          expect(err.message).to.equal('Request timed out');
          done();
        });
      });

      it('should merge all the filters with local', function(done) {
        let plugin = new QuasarPlugin({ identity, router, use });
        let remote1 = new BloomFilter({ filterDepth: 3, bitfieldSize: 160 });
        let remote2 = new BloomFilter({ filterDepth: 3, bitfieldSize: 160 });
        let remote3 = new BloomFilter({ filterDepth: 3, bitfieldSize: 160 });
        remote1[0].add('remote 1');
        remote2[0].add('remote 2');
        remote3[0].add('remote 3');
        let pullFilterFrom = sinon.stub(plugin, 'pullFilterFrom');
        pullFilterFrom.onCall(0).callsArgWith(1, null, remote1);
        pullFilterFrom.onCall(1).callsArgWith(1, null, remote2);
        pullFilterFrom.onCall(2).callsArgWith(1, null, remote3);
        plugin.pullFilters(() => {
          expect(pullFilterFrom.callCount).to.equal(3);
          expect(plugin.hasNeighborSubscribedTo('remote 1')).to.equal(true);
          expect(plugin.hasNeighborSubscribedTo('remote 2')).to.equal(true);
          expect(plugin.hasNeighborSubscribedTo('remote 3')).to.equal(true);
          done();
        });
      });

    });

    describe('@method pullFilterFrom', function() {

      it('should node#send with args and callback with atbf', function(done) {
        let plugin = new QuasarPlugin({ identity, router, use });
        let remote = new BloomFilter({ filterDepth: 3, bitfieldSize: 160 });
        remote[0].add('some topic');
        plugin.node.send = function(method, params, contact, callback) {
          expect(method).to.equal(QuasarPlugin.SUBSCRIBE_METHOD);
          expect(params).to.have.lengthOf(0);
          callback(null, remote.toHexArray());
        };
        plugin.pullFilterFrom([], (err, filter) => {
          expect(filter[0].has('some topic')).to.equal(true);
          done();
        });
      });

      it('should callback if transport error', function(done) {
        let plugin = new QuasarPlugin({ identity, router, use });
        let remote = new BloomFilter({ filterDepth: 3, bitfieldSize: 160 });
        remote[0].add('some topic');
        plugin.node.send = function(method, params, contact, callback) {
          callback(new Error('Timeout'));
        };
        plugin.pullFilterFrom([], (err) => {
          expect(err.message).to.equal('Timeout');
          done();
        });
      });

      it('should callback if bad result', function(done) {
        let plugin = new QuasarPlugin({ identity, router, use });
        let remote = new BloomFilter({ filterDepth: 3, bitfieldSize: 160 });
        remote[0].add('some topic');
        plugin.node.send = function(method, params, contact, callback) {
          callback(null, ['some', 'bad', 'data?']);
        };
        plugin.pullFilterFrom([], (err) => {
          expect(err.message).to.equal('Invalid hex string');
          done();
        });
      });

    });

    describe('@method pushFilters', function() {

      it('should push filters to each neighbor', function(done) {
        let plugin = new QuasarPlugin({ identity, router, use });
        let pushFilterTo = sinon.stub(plugin, 'pushFilterTo').callsArg(1);
        plugin.pushFilters(() => {
          expect(pushFilterTo.callCount).to.equal(3);
          done();
        });
      });

      it('should callback early if we updated within an hour', function(done) {
        let plugin = new QuasarPlugin({ identity, router, use });
        plugin._lastUpdate = Date.now();
        let pushFilterTo = sinon.stub(plugin, 'pushFilterTo').callsArg(1);
        plugin.pushFilters(() => {
          expect(pushFilterTo.callCount).to.equal(0);
          done();
        });
      });

    });

    describe('@method pushFilterTo', function() {

      it('should call node#send with correct args', function(done) {
        let plugin = new QuasarPlugin({ identity, router, use });
        plugin.node.send = function(method, params, contact, callback) {
          expect(method).to.equal(QuasarPlugin.UPDATE_METHOD);
          expect(params).to.have.lengthOf(constants.FILTER_DEPTH);
          callback();
        };
        plugin.pushFilterTo([], done);
      });

    });

    describe('@method isSubscribedTo', function() {

      it('should return true if subscribed and handling', function() {
        let plugin = new QuasarPlugin({ identity, router, use });
        plugin.filter[0].add('local topic');
        plugin.groups.set('local topic', true);
        expect(plugin.isSubscribedTo('local topic')).to.equal(true);
      });

      it('should return false if not subscribed and handling', function() {
        let plugin = new QuasarPlugin({ identity, router, use });
        expect(plugin.isSubscribedTo('local topic')).to.equal(false);
      });

    });

    describe('@hasNeighborSubscribedTo', function() {

      it('should return true if a neighbor is subscribed', function() {
        let plugin = new QuasarPlugin({ identity, router, use });
        plugin.filter[2].add('neighbor topic');
        expect(plugin.hasNeighborSubscribedTo('neighbor topic')).to.equal(true);
      });

      it('should return false if a neighbor is not subscribed', function() {
        let plugin = new QuasarPlugin({ identity, router, use });
        plugin.filter[2].add('neighbor topic');
        expect(plugin.hasNeighborSubscribedTo('wrong topic')).to.equal(false);
      });

    });

    describe('@private _getRandomContact', function() {

      it('should return a random contact', function() {
        let plugin = new QuasarPlugin({ identity, router, use });
        let firstResult = plugin._getRandomContact();
        expect(firstResult[0]).to.not.equal(plugin._getRandomContact()[0]);
      });

    });

  });

  describe('@class QuasarRules', function() {

    const identity = utils.getRandomKeyBuffer();
    const router = new RoutingTable(identity);

    before(function() {
      let numContacts = 32;

      while (numContacts > 0) {
        router.addContactByNodeId(utils.getRandomKeyString(), {
          hostname: 'localhost',
          port: 8080
        });
        numContacts--;
      }
    });

    describe('@method publish', function() {

      it('should callback error if already routed', function(done) {
        let rules = new QuasarRules({
          node: {
            router,
            identity
          },
          cached: { get: sinon.stub().returns(true) }
        });
        let send = sinon.stub();
        rules.publish({
          params: {
            uuid: uuid.v4(),
            topic: 'test',
            ttl: 3,
            contents: {}
          }
        }, { send }, (err) => {
          expect(err.message).to.equal('Message previously routed');
          expect(send.called).to.equal(false);
          done();
        });
      });

      it('should callback error if ttl greater than max', function(done) {
        let rules = new QuasarRules({
          node: {
            router,
            identity
          },
          cached: { get: sinon.stub().returns(false) }
        });
        let send = sinon.stub();
        rules.publish({
          params: {
            uuid: uuid.v4(),
            topic: 'test',
            ttl: 24,
            contents: {}
          }
        }, { send }, (err) => {
          expect(err.message).to.equal('Message includes invalid TTL');
          expect(send.called).to.equal(false);
          done();
        });
      });

      it('should callback error if ttl greater than max', function(done) {
        let rules = new QuasarRules({
          node: {
            router,
            identity
          },
          cached: { get: sinon.stub().returns(false) }
        });
        let send = sinon.stub();
        rules.publish({
          params: {
            uuid: uuid.v4(),
            topic: 'test',
            ttl: -1,
            contents: {}
          }
        }, { send }, (err) => {
          expect(err.message).to.equal('Message includes invalid TTL');
          expect(send.called).to.equal(false);
          done();
        });
      });

      it('should add to pubs, cache id, exec handler, relay', function(done) {
        let cachedSet = sinon.stub();
        let handler = sinon.stub();
        let rules = new QuasarRules({
          node: {
            router,
            identity
          },
          groups: {
            get: sinon.stub().returns(handler)
          },
          isSubscribedTo: sinon.stub().returns(true),
          cached: {
            get: sinon.stub().returns(false),
            set: cachedSet
          }
        });
        let id = uuid.v4();
        let _relayPublication = sinon.stub(rules, '_relayPublication')
                                  .callsArg(2);
        let msg = {
          uuid: id,
          topic: 'test',
          ttl: 3,
          contents: {},
          publishers: []
        };
        let send = (params) => {
          expect(Array.isArray(params)).to.equal(true);
          expect(params).to.have.lengthOf(0);
          expect(cachedSet.calledWithMatch(id)).to.equal(true);
          expect(msg.publishers.indexOf(identity.toString('hex'))).to.equal(0);
          expect(_relayPublication.callCount).to.equal(3);
          expect(handler.called).to.equal(true);
          done();
        };
        rules.publish({ params: msg }, { send });
      });

      it('should do nothing if not subscribed and ttl is 1', function(done) {
        let cachedSet = sinon.stub();
        let handler = sinon.stub();
        let rules = new QuasarRules({
          node: {
            router,
            identity
          },
          groups: {
            get: sinon.stub().returns(handler)
          },
          isSubscribedTo: sinon.stub().returns(false),
          cached: {
            get: sinon.stub().returns(false),
            set: cachedSet
          }
        });
        let id = uuid.v4();
        let _relayPublication = sinon.stub(rules, '_relayPublication')
                                  .callsArg(2);
        let msg = {
          uuid: id,
          topic: 'test',
          ttl: 1,
          contents: {},
          publishers: []
        };
        let send = (params) => {
          expect(Array.isArray(params)).to.equal(true);
          expect(params).to.have.lengthOf(0);
          expect(cachedSet.calledWithMatch(id)).to.equal(true);
          expect(_relayPublication.callCount).to.equal(0);
          done();
        };
        rules.publish({ params: msg }, { send });
      });

      it('should relay to neighbors if interested or random', function(done) {
        let cachedSet = sinon.stub();
        let handler = sinon.stub();
        let pullFilterFrom = sinon.stub().callsArgWith(1, null, []);
        let _getRandomContact = sinon.stub().returns([])
        let rules = new QuasarRules({
          node: {
            router,
            identity
          },
          pullFilterFrom: pullFilterFrom,
          _getRandomContact: _getRandomContact,
          groups: {
            get: sinon.stub().returns(handler)
          },
          isSubscribedTo: sinon.stub().returns(false),
          cached: {
            get: sinon.stub().returns(false),
            set: cachedSet
          }
        });
        let shouldRelayPublication = sinon.stub(
          QuasarRules,
          'shouldRelayPublication'
        ).returns(true);
        shouldRelayPublication.onCall(0).returns(false);
        let id = uuid.v4();
        let _relayPublication = sinon.stub(rules, '_relayPublication')
                                  .callsArg(2);
        let msg = {
          uuid: id,
          topic: 'test',
          ttl: 3,
          contents: {},
          publishers: []
        };
        let send = (params) => {
          shouldRelayPublication.restore();
          expect(Array.isArray(params)).to.equal(true);
          expect(params).to.have.lengthOf(0);
          expect(cachedSet.calledWithMatch(id)).to.equal(true);
          expect(_relayPublication.callCount).to.equal(3);
          expect(_getRandomContact.callCount).to.equal(1);
          done();
        };
        rules.publish({ params: msg }, { send });
      });

    });

    describe('@method subscribe', function() {

      it('should respond with a hex array of our filter', function(done) {
        let filter = new BloomFilter({ filterDepth: 3, bitfieldSize: 160 });
        filter[0].add('beep');
        filter[1].add('boop');
        filter[2].add('buup');
        let rules = new QuasarRules({ filter });
        rules.subscribe({}, {
          send: (params) => {
            expect(params).to.have.lengthOf(3);
            let filter = BloomFilter.from(params);
            expect(filter[0].has('beep')).to.equal(true);
            expect(filter[1].has('boop')).to.equal(true);
            expect(filter[2].has('buup')).to.equal(true);
            done();
          }
        });
      });

    });

    describe('@method update', function() {

      it('should merge remote filter with the local filter', function(done) {
        let local = new BloomFilter({ bitfieldSize: 160, filterDepth: 3 });
        let rules = new QuasarRules({ filter: local });
        let send = sinon.stub();
        rules.update({ params: { bad: 'data' } }, { send }, function(err) {
          expect(err.message).to.equal('Invalid bloom filters supplied');
          expect(send.called).to.equal(false);
          done();
        });
      });

      it('should callback error if failed to merge', function(done) {
        let local = new BloomFilter({ bitfieldSize: 160, filterDepth: 3 });
        let rules = new QuasarRules({ filter: local });
        let send = sinon.stub();
        rules.update({ params: ['bad', 'data?'] }, { send }, function(err) {
          expect(err.message).to.equal('Invalid hex string');
          expect(send.called).to.equal(false);
          done();
        });
      });

      it('should merge remote filter with the local filter', function(done) {
        let local = new BloomFilter({ bitfieldSize: 160, filterDepth: 3 });
        let remote = new BloomFilter({ bitfieldSize: 160, filterDepth: 3 });
        remote[0].add('test');
        let rules = new QuasarRules({ filter: local });
        rules.update({ params: remote.toHexArray() }, {
          send: (params) => {
            expect(params).to.have.lengthOf(0);
            expect(local[1].has('test')).to.equal(true);
            done();
          }
        })
      });

    });

    describe('@static shouldRelayPublication', function() {

      it('should return false if not in filter', function() {
        let request = {
          params: {
            topic: 'test topic',
            publishers: [
              'publisher 1'
            ]
          }
        };
        let filters = new BloomFilter({ bitfieldSize: 160, filterDepth: 3 });
        expect(
          QuasarRules.shouldRelayPublication(request, filters)
        ).to.equal(false);
      });

      it('should return false if negative publisher info', function() {
        let request = {
          params: {
            topic: 'test topic',
            publishers: [
              'publisher 1'
            ]
          }
        };
        let filters = new BloomFilter({ bitfieldSize: 160, filterDepth: 3 });
        filters[1].add('test topic');
        filters[2].add('publisher 1');
        expect(
          QuasarRules.shouldRelayPublication(request, filters)
        ).to.equal(false);
      });

      it('should return true if in filter and no negative info', function() {
        let request = {
          params: {
            topic: 'test topic',
            publishers: [
              'publisher 1'
            ]
          }
        };
        let filters = new BloomFilter({ bitfieldSize: 160, filterDepth: 3 });
        filters[0].add('test topic');
        expect(
          QuasarRules.shouldRelayPublication(request, filters)
        ).to.equal(true);
      });

    });

    describe('@private _relayPublication', function() {

      it('should call node#send with correct args', function(done) {
        let send = sinon.stub().callsArg(3);
        let rules = new QuasarRules({
          node: { send }
        });
        let request = {
          method: 'PUBLISH',
          params: {
            topic: 'test topic',
            ttl: 3
          }
        };
        let contact = [
          utils.getRandomKeyString(),
          { hostname: 'localhost', port: 8080 }
        ]
        rules._relayPublication(request, contact, () => {
          let args = send.args[0];
          expect(args[0]).to.equal('PUBLISH');
          expect(args[1].ttl).to.equal(2);
          expect(args[2]).to.equal(contact);
          done();
        });
      });

    });

  });

});
