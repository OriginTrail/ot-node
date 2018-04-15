'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const eclipse = require('../lib/plugin-eclipse');
const constants = require('../lib/constants');
const hdkey = require('hdkey');
const version = require('../lib/version');
const utils = require('../lib/utils');
const xprv = 'xprv9s21ZrQH143K2GRHtx45ZAuUjFnt6X58k37hYun7mTRdwX3R2u1JRDxMD6z' +
  'ZiTudK3QzgZozxhG6x8mpgAsUSojhqU3LeMhxAzAoSG55bai';


constants.IDENTITY_DIFFICULTY = 4;

describe('@module kadence/eclipse', function() {

  describe('@class EclipseIdentity', function() {

    it('should solve the index', function(done) {
      this.timeout(20000);
      const ident = new eclipse.EclipseIdentity(xprv);
      ident.solve().then(i => {
        expect(i).to.equal(10)
        done();
      }, done).catch(done);
    });

  });

  describe('@class EclipseRules', function() {

    const keys = hdkey.fromExtendedKey(xprv);

    it('should validate the derivation index', function(done) {
      const rules = new eclipse.EclipseRules({});
      rules.validate({
        contact: [
          utils.toPublicKeyHash(keys.publicKey).toString('hex'),
          {
            agent: version.protocol,
            xpub: keys.publicExtendedKey,
            index: 10
          }
        ]
      }, {}, err => {
        expect(err).to.equal(undefined);
        done();
      });
    });

    it('should invalidate the derivation index', function(done) {
      const rules = new eclipse.EclipseRules({});
      rules.validate({
        contact: [
          utils.toPublicKeyHash(keys.publicKey).toString('hex'),
          {
            agent: version.protocol,
            xpub: keys.publicExtendedKey,
            index: 9
          }
        ]
      }, {}, err => {
        expect(err.message).to.equal(
          'Identity key does not satisfy the network difficulty'
        );
        done();
      });
    });

    it('should invalidate the agent', function(done) {
      const rules = new eclipse.EclipseRules({});
      rules.validate({
        contact: [
          utils.toPublicKeyHash(keys.publicKey).toString('hex'),
          {
            agent: '0.0.0',
            xpub: keys.publicExtendedKey,
            index: 14
          }
        ]
      }, {}, err => {
        expect(err.message).to.equal('Unsupported protocol version 0.0.0');
        done();
      });
    });

  });

  describe('@class EclipsePlugin', function() {

    it('should call AbstractNode#use', function() {
      const use = sinon.stub();
      eclipse()({ use });
      expect(use.called).to.equal(true);
    });

  });

});
