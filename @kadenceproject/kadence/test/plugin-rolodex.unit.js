'use strict';

const { expect } = require('chai');
const rolodex = require('../lib/plugin-rolodex');
const sinon = require('sinon');
const RoutingTable = require('../lib/routing-table');
const utils = require('../lib/utils');
const path = require('path');
const os = require('os');


describe('@module kadence/rolodex', function() {

  const id = Buffer.from(utils.getRandomKeyString(), 'hex');
  const node = {
    router: new RoutingTable(id),
    logger: {
      warn: sinon.stub(),
      info: sinon.stub(),
      debug: sinon.stub()
    }
  };
  const plugin = rolodex(path.join(os.tmpdir(), id.toString('hex')))(node);

  let nodeid1 = utils.getRandomKeyString();
  let nodeid2 = utils.getRandomKeyString();

  it('should store the contact in the db', function(done) {
    let contact1 = {
      hostname: 'localhost',
      port: 8080,
      protocol: 'http:'
    };
    let contact2 = {
      hostname: 'localhost',
      port: 8081,
      protocol: 'http:'
    };
    node.router.addContactByNodeId(nodeid1, contact1);
    setTimeout(function() {
      node.router.addContactByNodeId(nodeid2, contact2);
      setTimeout(function() {
        plugin.getBootstrapCandidates().then(function(peers) {
          expect(peers[0]).to.equal(`http://localhost:8081/#${nodeid2}`);
          expect(peers[1]).to.equal(`http://localhost:8080/#${nodeid1}`);
          done();
        }, done);
      }, 20);
    }, 20);
  });

  describe('@class RolodexPlugin', function() {

    describe('@method getExternalPeerInfo', function() {

      it('should return the peer info', function(done) {
        plugin.getExternalPeerInfo(nodeid1).then(contact => {
          expect(contact.hostname).to.equal('localhost');
          expect(contact.port).to.equal(8080);
          expect(contact.protocol).to.equal('http:');
          done();
        }, done);
      });

    });

    describe('@method setInternalPeerInfo', function() {

      it('should set the internal peer info', function(done) {
        plugin.setInternalPeerInfo(nodeid1, {
          reputation: 95
        }).then(done, done);
      });

    });

    describe('@method getInternalPeerInfo', function() {

      it('should return the internal peer info', function(done) {
        plugin.getInternalPeerInfo(nodeid1).then(info => {
          expect(info.reputation).to.equal(95);
          done();
        }, done);
      });

    });

  });

});
