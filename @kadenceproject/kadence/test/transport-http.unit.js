'use strict';

const { expect } = require('chai');
const { Server, ClientRequest } = require('http');
const { Socket } = require('net');
const { EventEmitter } = require('events');
const { Readable: ReadableStream } = require('stream');
const sinon = require('sinon');
const constants = require('../lib/constants');
const HTTPTransport = require('../lib/transport-http');


describe('@class HTTPTransport', function() {

  describe('@constructor', function() {

    it('should bubble errors from the underlying server', function(done) {
      let httpTransport = new HTTPTransport();
      httpTransport.once('error', (err) => {
        expect(err.message).to.equal('Server error');
        done();
      });
      setImmediate(
        () => httpTransport.server.emit('error', new Error('Server error'))
      );
    });

    it('should call timeout pending requests every interval', function(done) {
      let clock = sinon.useFakeTimers();
      let httpTransport = new HTTPTransport();
      let _timeoutPending = sinon.stub(httpTransport, '_timeoutPending');
      setTimeout(() => {
        clock.restore();
        setImmediate(() => {
          expect(_timeoutPending.called).to.equal(true);
          done();
        });
      }, constants.T_RESPONSETIMEOUT);
      clock.tick(constants.T_RESPONSETIMEOUT);
    });

  });

  describe('@private _createRequest', function() {

    it('should return a client request object', function() {
      let httpTransport = new HTTPTransport();
      expect(httpTransport._createRequest({
        hostname: 'localhost',
        port: 8080,
        createConnection: () => new Socket()
      })).to.be.instanceOf(ClientRequest);
    });

  });

  describe('@private _createServer', function() {

    it('should return a http server object', function() {
      let httpTransport = new HTTPTransport();
      expect(httpTransport._createServer()).to.be.instanceOf(Server);
    });

  });

  describe('@private _timeoutPending', function() {

    it('should close the sockets that are timed out', function() {
      let httpTransport = new HTTPTransport();
      let end = sinon.stub();
      httpTransport._pending.set('1', {
        timestamp: Date.now() - constants.T_RESPONSETIMEOUT,
        response: { end }
      });
      httpTransport._pending.set('2', {
        timestamp: Date.now() - constants.T_RESPONSETIMEOUT,
        response: { end }
      });
      httpTransport._pending.set('3', {
        timestamp: Date.now(),
        response: { end }
      });
      httpTransport._timeoutPending();
      expect(httpTransport._pending.size).to.equal(1);
      expect(end.callCount).to.equal(2);
    });

  });

  describe('@private _read', function() {

    it('should bubble errors the incoming request', function(done) {
      let httpTransport = new HTTPTransport();
      let request = new ReadableStream({ read: () => null });
      request.headers = {};
      let response = new EventEmitter();
      response.end = sinon.stub();
      httpTransport.resume();
      setImmediate(() => {
        httpTransport.server.emit('request', request, response);
        setImmediate(() => {
          request.emit('error', new Error('Request error'));
        });
      });
      httpTransport.on('error', (err) => {
        expect(err.message).to.equal('Request error');
        done();
      });
    });

    it('should bubble errors the outgoing response', function(done) {
      let httpTransport = new HTTPTransport();
      let request = new ReadableStream({ read: () => null });
      request.headers = {};
      let response = new EventEmitter();
      response.end = sinon.stub();
      httpTransport.resume();
      setImmediate(() => {
        httpTransport.server.emit('request', request, response);
        setImmediate(() => {
          response.emit('error', new Error('Response error'));
        });
      });
      httpTransport.on('error', (err) => {
        expect(err.message).to.equal('Response error');
        done();
      });
    });

    it('should send back 400 if no message id header', function(done) {
      let httpTransport = new HTTPTransport();
      let request = new ReadableStream({ read: () => null });
      request.headers = {};
      let response = new EventEmitter();
      response.end = sinon.stub();
      httpTransport.resume();
      setImmediate(() => {
        httpTransport.server.emit('request', request, response);
        setImmediate(() => {
          expect(response.statusCode).to.equal(400);
          expect(response.end.called).to.equal(true);
          done();
        });
      });
    });

    it('should set code to 405 if not post or options', function(done) {
      let httpTransport = new HTTPTransport();
      let request = new ReadableStream({ read: () => null });
      request.headers = {
        'x-kad-message-id': 'message-id'
      };
      request.method = 'GET';
      let response = new EventEmitter();
      response.end = sinon.stub();
      response.setHeader = sinon.stub();
      httpTransport.resume();
      setImmediate(() => {
        httpTransport.server.emit('request', request, response);
        setImmediate(() => {
          expect(response.statusCode).to.equal(405);
          expect(response.end.called).to.equal(true);
          done();
        });
      });
    });

    it('should not process request if not post method', function(done) {
      let httpTransport = new HTTPTransport();
      let request = new ReadableStream({ read: () => null });
      request.headers = {
        'x-kad-message-id': 'message-id'
      };
      request.method = 'OPTIONS';
      let response = new EventEmitter();
      response.end = sinon.stub();
      response.setHeader = sinon.stub();
      httpTransport.resume();
      setImmediate(() => {
        httpTransport.server.emit('request', request, response);
        setImmediate(() => {
          expect(response.end.called).to.equal(true);
          done();
        });
      });
    });

    it('should buffer message, set pending, and push data', function(done) {
      let httpTransport = new HTTPTransport();
      let request = new ReadableStream({ read: () => null });
      request.headers = {
        'x-kad-message-id': 'message-id'
      };
      request.method = 'POST';
      let response = new EventEmitter();
      response.end = sinon.stub();
      response.setHeader = sinon.stub();
      httpTransport.once('data', (buffer) => {
        expect(buffer.toString()).to.equal('test');
        expect(httpTransport._pending.get('message-id').response).to.equal(
          response
        );
        done();
      });
      setImmediate(() => {
        httpTransport.server.emit('request', request, response);
        setImmediate(() => {
          request.push(Buffer.from('test'));
          request.push(null);
        });
      });
    });

  });

  describe('@private _write', function() {

    it('should respond to the pending request if matched', function(done) {
      let httpTransport = new HTTPTransport();
      let response = { end: sinon.stub() };
      httpTransport._pending.set('test', {
        timestamp: Date.now(),
        response
      });
      httpTransport.write(['test', Buffer.from('test'), [
        'RECEIVER',
        {
          hostname: 'localhost',
          port: 8080
        }
      ]]);
      setImmediate(() => {
        expect(response.end.called).to.equal(true);
        expect(httpTransport._pending.size).to.equal(0);
        done();
      });
    });

    it('should create a request and push the response back', function(done) {
      let httpTransport = new HTTPTransport();
      let request = new EventEmitter();
      request.end = sinon.stub();
      let _createRequest = sinon.stub(httpTransport, '_createRequest')
                             .returns(request);
      httpTransport.write(['test', Buffer.from('test'), ['RECEIVER', {
        hostname: 'localhost',
        port: 8080,
        protocol: 'http:'
      }]]);
      setImmediate(() => {
        let response = new ReadableStream({ read: ()=> null });
        request.emit('response', response);
        setImmediate(() => {
          response.push(Buffer.from('test'));
          response.push(null);
          setImmediate(() => {
            expect(httpTransport.read().toString()).to.equal('test');
            _createRequest.restore();
            done();
          });
        });
      });
    });

    it('should create a request and emit an error event', function(done) {
      let httpTransport = new HTTPTransport();
      let request = new EventEmitter();
      request.end = sinon.stub();
      let _createRequest = sinon.stub(httpTransport, '_createRequest')
                             .returns(request);
      httpTransport.write(['test', Buffer.from('test'), ['RECEIVER', {
        hostname: 'localhost',
        port: 8080,
        protocol: 'http:'
      }]]);
      setImmediate(() => {
        let response = new ReadableStream({ read: ()=> null });
        response.statusCode = 400;
        request.emit('response', response);
        httpTransport.once('error', (err) => {
          _createRequest.restore();
          expect(err.message).to.equal('Bad request');
          done();
        });
        setImmediate(() => {
          response.push(Buffer.from('Bad request'));
          response.push(null);
        });
      });
    });

    it('should bubble response errors', function(done) {
      let httpTransport = new HTTPTransport();
      let request = new EventEmitter();
      request.end = sinon.stub();
      let _createRequest = sinon.stub(httpTransport, '_createRequest')
                             .returns(request);
      httpTransport.write(['test', Buffer.from('test'), ['RECEIVER', {
        hostname: 'localhost',
        port: 8080,
        protocol: 'http:'
      }]]);
      setImmediate(() => {
        let response = new ReadableStream({ read: ()=> null });
        request.emit('response', response);
        setImmediate(() => {
          httpTransport.once('error', (err) => {
            expect(err.message).to.equal('Response error');
            _createRequest.restore();
            done();
          });
          setImmediate(() => {
            response.emit('error', new Error('Response error'));
          });
        });
      });
    });

    it('should bubble request errors', function(done) {
      let httpTransport = new HTTPTransport();
      let request = new EventEmitter();
      request.end = sinon.stub();
      let _createRequest = sinon.stub(httpTransport, '_createRequest')
                             .returns(request);
      httpTransport.write(['test', Buffer.from('test'), ['RECEIVER', {
        hostname: 'localhost',
        port: 8080,
        protocol: 'http:'
      }]]);
      httpTransport.once('error', (err) => {
        expect(err.message).to.equal('Request error');
        _createRequest.restore();
        done();
      });
      setImmediate(() => {
        request.emit('error', new Error('Request error'));
      });
    });
  });

  describe('@method listen', function() {

    it('should call Server#listen with args', function() {
      let httpTransport = new HTTPTransport();
      let listen = sinon.stub(httpTransport.server, 'listen');
      httpTransport.listen(8080, 'localhost');
      expect(listen.calledWithMatch(8080, 'localhost'));
    });

  });

});
