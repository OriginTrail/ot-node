'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const { createHash } = require('crypto');
const { ContentAddressPlugin } = require('../lib/plugin-contentaddress');


describe('@class ContentAddressPlugin', function() {

  let node = {
    use: sinon.stub()
  };
  let content = null;

  before(() => {
    content = new ContentAddressPlugin(node);
  });

  describe('@method validate', function() {

    it('should error if key not equal to hash', function(done) {
      content.validate({
        params: ['000000', {
          value: Buffer.from('data').toString('base64')
        }]
      }, {}, (err) => {
        expect(err.message).to.equal('Item failed validation check');
        done();
      });
    });

    it('should callback if key equals hash', function(done) {
      content.validate({
        params: [
          createHash('rmd160').update(Buffer.from('data')).digest('hex'),
          { value: Buffer.from('data').toString('base64') }
        ]
      }, {}, (err) => {
        expect(err).to.equal(undefined);
        done();
      });
    });

  });

});
