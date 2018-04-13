'use strict';

const { expect } = require('chai');
const { Server } = require('https');
const { ClientRequest } = require('http');
const { Socket } = require('net');
const pem = require('pem');
const HTTPSTransport = require('../lib/transport-https');


describe('@class HTTPSTransport', function() {

  let httpsTransport;

  before((done) => {
    pem.createCertificate({ days: 1, selfSigned: true }, (err, keys) => {
      httpsTransport = new HTTPSTransport({
        key: keys.serviceKey,
        cert: keys.certificate
      });
      done();
    });
  });

  describe('@private _createRequest', function() {

    it('should return a client request object', function() {
      let req = httpsTransport._createRequest({
        hostname: 'localhost',
        port: 8080,
        createConnection: () => new Socket()
      });
      expect(req).to.be.instanceOf(ClientRequest);
    });

  });

  describe('@private _createServer', function() {

    it('should return an instance of https.Server', function() {
      expect(httpsTransport.server).to.be.instanceOf(Server);
    });

  });

});
