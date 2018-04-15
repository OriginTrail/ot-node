'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const AbstractNode = require('../lib/node-abstract');
const FakeTransport = require('./fixtures/transport-fake');
const levelup = require('levelup');
const memdown = require('memdown');
const storage = levelup('test:node-abstract', memdown);
const bunyan = require('bunyan');
const constants = require('../lib/constants');
const utils = require('../lib/utils');


describe('@class AbstractNode', function() {

  let logger, logwarn, transport, abstractNode, clock;

  before(() => {
    clock = sinon.useFakeTimers(Date.now(), 'setInterval');
    logger = bunyan.createLogger({
      name: 'test:node-abstract:unit',
      level: 'fatal'
    });
    logwarn = sinon.stub(logger, 'warn');
    transport = new FakeTransport();
    abstractNode = new AbstractNode({
      contact: { name: 'test:node-abstract:unit' },
      storage,
      transport,
      logger,
      identity: utils.getRandomKeyString()
    });
  });

  after(() => {
    clock.restore();
  });

  describe('@private _init', function() {

    it('should log warnings on messenger error', function(done) {
      abstractNode.rpc.emit('error', new Error('Messenger error'));
      setImmediate(() => {
        expect(logwarn.called).to.equal(true);
        logwarn.reset();
        done();
      });
    });

    it('should call _process on data from deserializer', function(done) {
      let _process = sinon.stub(abstractNode, '_process');
      let message = [];
      abstractNode.rpc.deserializer.emit('data', message);
      setImmediate(() => {
        _process.restore();
        expect(_process.called).to.equal(true);
        done();
      });
    });

    it('should log warnings on transport error', function(done) {
      abstractNode.transport.emit('error', new Error('Transport error'));
      setImmediate(() => {
        expect(logwarn.called).to.equal(true);
        logwarn.reset();
        done();
      });
    });

    it('should call the _timeout method on interval', function(done) {
      let _timeout = sinon.stub(abstractNode, '_timeout');
      setImmediate(() => {
        _timeout.restore();
        expect(_timeout.called).to.equal(true);
        done();
      }, constants.T_RESPONSETIMEOUT);
      clock.tick(constants.T_RESPONSETIMEOUT);
    });

    it('should repipe to the deserializer on error', function(done) {
      let pipe = () => done();
      abstractNode.rpc.deserializer.emit('unpipe', { pipe });
    });

  });

  describe('@private _process', function() {

    it('should call receive with error arguments', function(done) {
      let _updateContact = sinon.stub(abstractNode, '_updateContact');
      let write = sinon.stub(abstractNode.rpc.serializer, 'write');
      let receive = sinon.stub(abstractNode, 'receive')
        .callsFake(function(req, res) {
          receive.restore();
          _updateContact.restore();
          expect(_updateContact.called).to.equal(true);
          expect(req.method).to.equal('PING');
          expect(req.id).to.equal('message id');
          expect(req.params).to.have.lengthOf(0);
          expect(req.contact[0]).to.equal('SENDERID');
          expect(req.contact[1].hostname).to.equal('localhost');
          expect(req.contact[1].port).to.equal(8080);
          res.error('Error', 500);
          write.restore();
          let writeArgs = write.args[0][0];
          expect(writeArgs[0].id).to.equal('message id');
          expect(writeArgs[0].error.message).to.equal('Error');
          expect(typeof writeArgs[1][0]).to.equal('string');
          expect(writeArgs[1][1].name).to.equal('test:node-abstract:unit');
          expect(writeArgs[2][1].hostname).to.equal('localhost');
          expect(writeArgs[2][1].port).to.equal(8080);
          done();
        });
      abstractNode._process([
        {
          type: 'request',
          payload: {
            id: 'message id',
            method: 'PING',
            params: []
          }
        },
        {
          type: 'notification',
          payload: {
            params: [
              'SENDERID',
              {
                hostname: 'localhost',
                port: 8080
              }
            ]
          }
        }
      ]);
    });

    it('should call receive with success arguments', function(done) {
      let _updateContact = sinon.stub(abstractNode, '_updateContact');
      let write = sinon.stub(abstractNode.rpc.serializer, 'write');
      let receive = sinon.stub(abstractNode, 'receive')
        .callsFake(function(req, res) {
          receive.restore();
          _updateContact.restore();
          expect(_updateContact.called).to.equal(true);
          expect(req.method).to.equal('PING');
          expect(req.id).to.equal('message id');
          expect(req.params).to.have.lengthOf(0);
          expect(req.contact[0]).to.equal('SENDERID');
          expect(req.contact[1].hostname).to.equal('localhost');
          expect(req.contact[1].port).to.equal(8080);
          res.send([]);
          write.restore();
          let writeArgs = write.args[0][0];
          expect(writeArgs[0].id).to.equal('message id');
          expect(writeArgs[0].result).to.have.lengthOf(0);
          expect(typeof writeArgs[1][0]).to.equal('string');
          expect(writeArgs[1][1].name).to.equal('test:node-abstract:unit');
          expect(writeArgs[2][1].hostname).to.equal('localhost');
          expect(writeArgs[2][1].port).to.equal(8080);
          done();
        });
      abstractNode._process([
        {
          type: 'request',
          payload: {
            id: 'message id',
            method: 'PING',
            params: []
          }
        },
        {
          type: 'notification',
          payload: {
            params: [
              'SENDERID',
              {
                hostname: 'localhost',
                port: 8080
              }
            ]
          }
        }
      ]);
    });

    it('should log a warning if not expecting response', function(done) {
      let _updateContact = sinon.stub(abstractNode, '_updateContact');
      abstractNode._process([
        {
          type: 'success',
          payload: {
            id: 'message id',
            result: []
          }
        },
        {
          type: 'notification',
          payload: {
            params: [
              'SENDERID',
              {
                hostname: 'localhost',
                port: 8080
              }
            ]
          }
        }
      ]);
      _updateContact.restore();
      expect(logwarn.called).to.equal(true);
      logwarn.reset();
      done();
    });

    it('should execute the expected handler with an error', function(done) {
      let _updateContact = sinon.stub(abstractNode, '_updateContact');
      abstractNode._pending.set('message id', {
        timestamp: Date.now(),
        handler: (err, result) => {
          expect(result).to.equal(null);
          expect(err.message).to.equal('Error response');
          done();
        }
      });
      abstractNode._process([
        {
          type: 'error',
          payload: {
            id: 'message id',
            error: {
              code: 0,
              message: 'Error response'
            }
          }
        },
        {
          type: 'notification',
          payload: {
            params: [
              'SENDERID',
              {
                hostname: 'localhost',
                port: 8080
              }
            ]
          }
        }
      ]);
      _updateContact.restore();
    });

    it('should execute the expected handler with data', function(done) {
      let _updateContact = sinon.stub(abstractNode, '_updateContact');
      abstractNode._pending.set('message id', {
        timestamp: Date.now(),
        handler: (err, result) => {
          expect(result).to.have.lengthOf(0);
          expect(err).to.equal(null);
          done();
        }
      });
      abstractNode._process([
        {
          type: 'success',
          payload: {
            id: 'message id',
            result: []
          }
        },
        {
          type: 'notification',
          payload: {
            params: [
              'SENDERID',
              {
                hostname: 'localhost',
                port: 8080
              }
            ]
          }
        }
      ]);
      _updateContact.restore();

    });

  });

  describe('@private _timeout', function() {

    it('should call handlers of old requests and reap references', function() {
      let handler0 = sinon.stub();
      let handler1 = sinon.stub();
      let handler2 = sinon.stub();
      abstractNode._pending.set(0, {
        handler: handler0,
        timestamp: Date.now()
      });
      abstractNode._pending.set(1, {
        handler: handler1,
        timestamp: Date.now() - constants.T_RESPONSETIMEOUT - 200
      });
      abstractNode._pending.set(2, {
        handler: handler2,
        timestamp: 0
      });
      abstractNode._timeout();
      expect(handler0.called).to.equal(false);
      expect(handler1.called).to.equal(true);
      expect(handler1.args[0][0]).to.be.instanceOf(Error);
      expect(handler2.called).to.equal(true);
      expect(handler2.args[0][0]).to.be.instanceOf(Error);
      expect(abstractNode._pending.size).to.equal(1);
    });

  });

  describe('@private _updateContact', function() {

    it('should call RoutingTable#addContactByNodeId', function() {
      let _addContactByNodeId = sinon.stub(abstractNode.router,
                                           'addContactByNodeId');
      abstractNode._updateContact('node id', {});
      _addContactByNodeId.restore();
      expect(
        _addContactByNodeId.calledWithMatch('node id', {})
      ).to.equal(true);
    });

    it('should not call RoutingTable#addContactByNodeId', function() {
      let _addContactByNodeId = sinon.stub(abstractNode.router,
                                           'addContactByNodeId');
      abstractNode._updateContact(abstractNode.identity.toString('hex'), {});
      _addContactByNodeId.restore();
      expect(
        _addContactByNodeId.calledWithMatch(
          abstractNode.identity.toString('hex'),
          {}
        )
      ).to.equal(false);
    });

  });

  describe('@private _stack', function() {

    it('should call all functions in the stack with args', function(done) {
      let mw1 = sinon.stub().callsArg(2);
      let mw2 = sinon.stub().callsArg(2);
      let mw3 = sinon.stub().callsArg(2);
      let mw4 = sinon.stub().callsArg(2);
      let request = {};
      let response = {};
      abstractNode._testStack = {
        '*': [mw1, mw2, mw3, mw4]
      };
      abstractNode._stack('_testStack', '*', [request, response], () => {
        delete abstractNode._testStack;
        expect(mw1.calledWithMatch(request, response)).to.equal(true);
        expect(mw2.calledWithMatch(request, response)).to.equal(true);
        expect(mw3.calledWithMatch(request, response)).to.equal(true);
        expect(mw4.calledWithMatch(request, response)).to.equal(true);
        done();
      });
    });

    it('should trap exceptions in middleware and callback', function(done) {
      let mw1 = sinon.stub().callsArg(2);
      let mw2 = sinon.stub().throws(new Error('Syntax error'));
      let mw3 = sinon.stub().callsArg(2);
      let mw4 = sinon.stub().callsArg(2);
      let request = {};
      let response = {};
      abstractNode._testStack = {
        '*': [mw1, mw2, mw3, mw4]
      };
      abstractNode._stack('_testStack', '*', [request, response], () => {
        delete abstractNode._testStack;
        expect(mw1.calledWithMatch(request, response)).to.equal(true);
        expect(mw2.calledWithMatch(request, response)).to.equal(true);
        expect(mw3.calledWithMatch(request, response)).to.equal(false);
        expect(mw4.calledWithMatch(request, response)).to.equal(false);
        done();
      });
    });

    it('should fire callback if no stack exists', function(done) {
      abstractNode._stack('_middlewares', 'NOTAMETHOD', [{}, {}], done);
    });

  });

  describe('@private _middleware', function() {

    it('should call _stack with the correct arguments', function() {
      let _stack = sinon.stub(abstractNode, '_stack');
      let args = ['REQUEST', 'RESPONSE'];
      abstractNode._middleware(...args);
      _stack.restore();
      expect(
        _stack.calledWithMatch('_middleware', 'REQUEST', 'RESPONSE')
      ).to.equal(true);
    });

  });

  describe('@private _error', function() {

    it('should call _stack with the correct arguments', function() {
      let _stack = sinon.stub(abstractNode, '_stack');
      let args = ['REQUEST', 'RESPONSE'];
      abstractNode._error(...args);
      _stack.restore();
      expect(
        _stack.calledWithMatch('_errors', 'REQUEST', 'RESPONSE')
      ).to.equal(true);
    });

  });

  describe('@method send', function() {

    it('should write to serializer and queue handler', function() {
      let write = sinon.stub(abstractNode.rpc.serializer, 'write');
      let handler = sinon.stub();
      abstractNode.send('PING', [], ['000000', {
        hostname: 'localhost',
        port: 8080
      }], handler);
      let [calledWith] = write.args[0];
      write.restore();
      expect(calledWith[0].method).to.equal('PING');
      expect(calledWith[0].params).to.have.lengthOf(0);
      expect(typeof calledWith[0].id).to.equal('string');
      expect(calledWith[1][0]).to.equal(abstractNode.identity.toString('hex'));
      expect(calledWith[1][1].name).to.equal('test:node-abstract:unit');
      expect(calledWith[2][1].hostname).to.equal('localhost');
      expect(calledWith[2][1].port).to.equal(8080);
    });

    it('should error and not send if invalid target', function(done) {
      abstractNode.send('PING', [], {
        hostname: 'localhost',
        port: 8080
      }, (err) => {
        expect(err.message).to.equal(
          'Refusing to send message to invalid contact'
        );
        done();
      });
    });

    it('should remove from the routing table if timeout', function(done) {
      let write = sinon.stub(abstractNode.rpc.serializer, 'write');
      let remove = sinon.stub(abstractNode.router, 'removeContactByNodeId');
      abstractNode._pending.clear();
      abstractNode.send('PING', [], ['000000', {
        hostname: 'localhost',
        port: 8080
      }], (err) => {
        expect(remove.called).to.equal(true);
        expect(err.type).to.equal('TIMEOUT');
        done();
      });
      setImmediate(() => {
        let id = abstractNode._pending.keys().next().value;
        let err = new Error('Timeout');
        err.type = 'TIMEOUT';
        abstractNode._pending.get(id).handler(err);
        write.restore();
      });
    });

  });

  describe('@method use', function() {

    it('should use the * method if none supplied', function() {
      abstractNode.use((req, res, next) => next());
      expect(abstractNode._middlewares['*']).to.have.lengthOf(1);
    });

    it('should place it in _errors if 4 args', function() {
      abstractNode.use((err, req, res, next) => next());
      expect(abstractNode._errors['*']).to.have.lengthOf(1);
    });

    it('should use a custom method stack', function() {
      abstractNode.use('TEST', (req, res, next) => next());
      expect(abstractNode._middlewares.TEST).to.have.lengthOf(1);
    });

  });

  describe('@method plugin', function() {

    it('should throw if not a function', function() {
      expect(function() {
        abstractNode.plugin({});
      }).to.throw(Error, 'Invalid plugin supplied');
    });

    it('should call the function with itself as the first arg', function(done) {
      abstractNode.plugin(function(node) {
        expect(node).to.equal(abstractNode);
        done();
      });
    });

  });

  describe('@method receive', function() {

    it('should pass the args through all middleware', function(done) {
      let _middleware = sinon.stub(abstractNode, '_middleware').callsArg(2);
      let _error = sinon.stub(abstractNode, '_error').callsArg(2);
      let args = [{ method: 'TEST' }, {}];
      abstractNode.receive(...args);
      setTimeout(() => {
        expect(_middleware.calledWithMatch('*', args)).to.equal(true);
        expect(_middleware.calledWithMatch('TEST', args)).to.equal(true);
        expect(
          _error.calledWithMatch('*', [null, ...args])
        ).to.equal(true);
        expect(
          _error.calledWithMatch('TEST', [null, ...args])
        ).to.equal(true);
        done();
      }, 50);
    });

  });

  describe('@method listen', function() {

    it('should add error middleware and init transport', function() {
      let _listen = sinon.stub(abstractNode.transport, 'listen');
      abstractNode._errors['*'] = [];
      abstractNode.listen(8080, 'localhost');
      _listen.restore();
      expect(_listen.calledWithMatch(8080, 'localhost')).to.equal(true);
      expect(abstractNode._errors['*']).to.have.lengthOf(2);
    });

  });

});
