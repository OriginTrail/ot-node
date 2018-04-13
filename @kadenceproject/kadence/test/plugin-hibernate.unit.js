'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const stream = require('stream');
const { HibernatePlugin } = require('../lib/plugin-hibernate');


describe('@module kademlia/hibernate', function() {

  let clock = null;
  let node = {
    rpc: {
      serializer: {
        append: sinon.stub()
      },
      deserializer: {
        prepend: sinon.stub()
      }
    },
    use: sinon.stub()
  };
  let hibernate = null;

  before(() => {
    clock = sinon.useFakeTimers('setTimeout');
    hibernate = new HibernatePlugin(node, {
      limit: '5gb',
      interval: '24hr',
      reject: ['STORE', 'FIND_VALUE']
    });
  });

  after(() => clock.restore());

  describe('@constructor', function() {

    it('should convert limit and interval to numbers', function() {
      expect(hibernate.limit).to.equal(5368709120);
    });

    it('should prepend meter("inbound") to deserializer', function() {
      expect(hibernate.interval).to.equal(86400000);
    });

    it('should append meter("outbound") to serializer', function() {
      expect(node.rpc.serializer.append.args[0][0]).to.be.instanceOf(
        stream.Transform
      );
    });

    it('should pass detect method to node#use', function() {
      expect(node.rpc.deserializer.prepend.args[0][0]).to.be.instanceOf(
        stream.Transform
      );
    });

    it('should call HibernatePlugin#start', function() {
      expect(hibernate.accounting).to.not.equal(undefined);
    });

  });

  describe('@property hibernating', function() {

    it('should return false if total is greater than limit', function() {
      expect(hibernate.hibernating).to.equal(false);
    });

    it('should return true if total is less than limit', function() {
      hibernate.accounting.inbound = 5368709120 / 2;
      hibernate.accounting.outbound = 5368709120 / 2;
      expect(hibernate.hibernating).to.equal(true);
    });

  });

  describe('@method start', function() {

    it('should emit start on first run', function(done) {
      delete hibernate.accounting;
      hibernate.once('start', done);
      setImmediate(() => hibernate.start());
    });

    it('should emit reset on each consecutive run', function(done) {
      hibernate.once('reset', () => done());
      setImmediate(() => clock.tick(hibernate.interval));
    });

  });

  describe('@method meter', function() {

    it('should return transform stream increments outbound', function(done) {
      const stream = hibernate.meter('outbound');
      stream.once('data', () => {
        expect(hibernate.accounting.outbound).to.equal(4);
        done();
      });
      setImmediate(() => stream.write([
        'message-id',
        Buffer.from([0, 0, 0, 0]),
        ['identity', { hostname: 'localhost', port: 8080 }]
      ]));
    });

    it('should return transform stream increments inbound', function(done) {
      const stream = hibernate.meter('inbound');
      stream.once('data', () => {
        expect(hibernate.accounting.inbound).to.equal(6);
        done();
      });
      setImmediate(() => stream.write(Buffer.from([0, 0, 0, 0, 0, 0])));
    });

    it('should return transform stream increments unknown', function(done) {
      const stream = hibernate.meter();
      stream.once('data', () => {
        expect(hibernate.accounting.unknown).to.equal(3);
        done();
      });
      setImmediate(() => stream.write('lol'));
    });

  });

  describe('@method detect', function() {

    it('should error if hibernating and reject method', function(done) {
      hibernate.accounting.inbound = 5368709120;
      hibernate.detect({ method: 'STORE' }, {}, (err) => {
        expect(err.message).to.equal('Hibernating, try STORE again later');
        done();
      });
    });

    it('should callback if hibernating and accept method', function(done) {
      hibernate.detect({ method: 'FIND_NODE' }, {}, (err) => {
        expect(err).to.equal(undefined);
        done();
      });
    });

    it('should callback if not hibernating', function(done) {
      hibernate.accounting.inbound = 0;
      hibernate.detect({ method: 'STORE' }, {}, (err) => {
        expect(err).to.equal(undefined);
        done();
      });
    });

  });

});
