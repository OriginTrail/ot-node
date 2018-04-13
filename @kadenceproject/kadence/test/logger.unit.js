'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const logger = require('../lib/logger');


describe('@class logger#IncomingMessage', function() {

  it('should not log if there is no contact', function(done) {
    let log = { info: sinon.stub() };
    let incoming = new logger.IncomingMessage(log);
    incoming.write([
      { payload: { method: 'PING' } },
      { payload: { params: [] } }
    ]);
    setImmediate(() => {
      expect(log.info.called).to.equal(false);
      done();
    });
  });

  it('should log if there is message is request', function(done) {
    let log = { info: sinon.stub() };
    let incoming = new logger.IncomingMessage(log);
    incoming.write([
      { payload: { method: 'PING' } },
      { payload: { params: ['identity', { hostname: 'test', port: 80 }] } }
    ]);
    setImmediate(() => {
      expect(log.info.calledWithMatch('received PING')).to.equal(true);
      done();
    });
  });

  it('should log if there is message is response', function(done) {
    let log = { info: sinon.stub() };
    let incoming = new logger.IncomingMessage(log);
    incoming.write([
      { payload: { id: 'test' } },
      { payload: { params: ['identity', { hostname: 'test', port: 80 }] } }
    ]);
    setImmediate(() => {
      expect(log.info.calledWithMatch('received response')).to.equal(true);
      done();
    });
  });

});

describe('@class logger#OutgoingMessage', function() {

  it('should not log if there is no contact', function(done) {
    let log = { info: sinon.stub() };
    let incoming = new logger.OutgoingMessage(log);
    incoming.write([
      { method: 'PING' },
      { },
      []
    ]);
    setImmediate(() => {
      expect(log.info.called).to.equal(false);
      done();
    });
  });

  it('should log if there is message is request', function(done) {
    let log = { info: sinon.stub() };
    let incoming = new logger.OutgoingMessage(log);
    incoming.write([
      { method: 'PING' },
      { },
      ['identity', { hostname: 'test', port: 80 }]
    ]);
    setImmediate(() => {
      expect(log.info.calledWithMatch('sending PING')).to.equal(true);
      done();
    });
  });

  it('should log if there is message is response', function(done) {
    let log = { info: sinon.stub() };
    let incoming = new logger.OutgoingMessage(log);
    incoming.write([
      { id: 'test' },
      { },
      ['identity', { hostname: 'test', port: 80 }]
    ]);
    setImmediate(() => {
      expect(log.info.calledWithMatch('sending response')).to.equal(true);
      done();
    });
  });

});
