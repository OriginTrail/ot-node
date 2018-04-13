'use strict';

const { expect } = require('chai');
const version = require('../lib/version');


describe('@module kadence/version', function() {

  describe('@function toString', function() {

    it('should return the version string', function() {
      expect(version.toString()).to.equal(
        `kadence v${version.software} protocol v${version.protocol}`
      );
    });

  });

});
