'use strict';

const { expect } = require('chai');
const Control = require('../lib/control');
const RoutingTable = require('../lib/routing-table');
const utils = require('../lib/utils');
const sinon = require('sinon');
const secp256k1 = require('secp256k1');


describe('@class Control', function() {

  describe('@method listMethods', function() {

    it('should return all the supported methods', function(done) {
      const control = new Control({});
      control.listMethods((err, results) => {
        expect(results).to.have.lengthOf(15);
        done();
      });
    });

  });

  describe('@method getProtocolInfo', function() {

    it('should return general information', function(done) {
      const control = new Control({
        router: new RoutingTable(
          Buffer.from(utils.getRandomKeyString(), 'hex')
        ),
        identity: Buffer.from(utils.getRandomKeyString(), 'hex'),
        contact: {
          hostname: 'localhost',
          port: 8080
        }
      });
      control.node.router.addContactByNodeId(
        utils.getRandomKeyString(),
        { hostname: 'localhost', port: 8081 }
      );
      control.getProtocolInfo((err, result) => {
        expect(typeof result.versions.software).to.equal('string');
        expect(typeof result.versions.protocol).to.equal('string');
        expect(typeof result.identity).to.equal('string');
        expect(typeof result.contact.port).to.equal('number');
        expect(typeof result.contact.hostname).to.equal('string');
        expect(Array.isArray(result.peers)).to.equal(true);
        expect(result.peers).to.have.lengthOf(1);
        done();
      });
    });

  });

  describe('@method getWalletBalance', function() {

    it('should return the wallet balance', function(done) {
      const control = new Control({
        wallet: {
          balance: 10
        }
      });
      control.getWalletBalance((err, result) => {
        expect(result.total).to.equal(10);
        done();
      });
    });

  });

  describe('@method getWalletSolutionKeys', function() {

    it('should return the wallet solution keys', function(done) {
      const solutions = ['a', 'b', 'c'];
      const control = new Control({
        wallet: {
          solutions
        }
      });
      control.getWalletSolutionKeys((err, result) => {
        expect(result).to.equal(solutions);
        done();
      });
    });

  });

  describe('@method getWalletSolution', function() {

    it('should return the wallet solution', function(done) {
      const control = new Control({
        wallet: {
          get() {
            return {
              toBuffer() {
                return Buffer.from('000000', 'hex');
              }
            };
          }
        }
      });
      control.getWalletSolution('key', (err, result) => {
        expect(result).to.equal('000000');
        done();
      });
    });

  });

  describe('@method putWalletSolution', function() {

    it('should insert the solution', function(done) {
      const put = sinon.stub();
      const control = new Control({
        wallet: {
          put
        }
      });
      const buf = Buffer.alloc(260).fill(0).toString('hex');
      control.putWalletSolution(buf, (err) => {
        expect(err).to.equal(null);
        expect(put.called).to.equal(true);
        done();
      });
    });

  });

  describe('@method transferWalletSolution', function() {

    it('should transfer and update the solution', function(done) {
      const put = sinon.stub();
      const transfer = sinon.stub();
      const control = new Control({
        wallet: {
          put,
          transfer
        }
      });
      const sol = Buffer.alloc(32).fill(0).toString('hex');
      const pub = Buffer.alloc(33).fill(1).toString('hex');
      control.transferWalletSolution(sol, pub, (err) => {
        expect(err).to.equal(null);
        expect(transfer.called).to.equal(true);
        expect(put.called).to.equal(true);
        done();
      });
    });

  });

  describe('@method signMessage', function() {

    it('should sign the message and return signature', function(done) {
      const privateKey = Buffer.from(
        '96c7a7c1e2835f9732954dd2a3dcb57b2f8bf0cce502e8c77c84cf75e73791fc',
        'hex'
      );
      const message = utils.hash256(Buffer.from('beep boop'));
      const signature = Buffer.from(
        '67682424bce11239d43870bf6b35509fece926e64841530194bd325af46378f2292' +
          '482c18f4088ad1fc9df2dceec85826c26c925a9dd30d54115be09869d9dea',
        'hex'
      );
      const control = new Control({
        wallet: {
          privateKey
        }
      });
      control.signMessage(message.toString('hex'), (err, result) => {
        expect(err).to.equal(null);
        expect(result.signature).to.equal(signature.toString('hex'));
        expect(result.recovery).to.equal(1);
        done();
      });
    });

  });

  describe('@method verifyMessage', function() {

    it('should verify the message is valid signature', function(done) {
      const privateKey = Buffer.from(
        '96c7a7c1e2835f9732954dd2a3dcb57b2f8bf0cce502e8c77c84cf75e73791fc',
        'hex'
      );
      const publicKey = secp256k1.publicKeyCreate(privateKey);
      const message = utils.hash256(Buffer.from('beep boop'));
      const signature = Buffer.from(
        '67682424bce11239d43870bf6b35509fece926e64841530194bd325af46378f2292' +
          '482c18f4088ad1fc9df2dceec85826c26c925a9dd30d54115be09869d9dea',
        'hex'
      );
      const control = new Control();
      control.verifyMessage(
        message.toString('hex'),
        signature.toString('hex'),
        publicKey.toString('hex'),
        (err, result) => {
          expect(err).to.equal(null);
          expect(result).to.equal(true);
          done();
        }
      );
    });

  });

});
