'use strict';

const { expect } = require('chai');
const permission = require('../lib/plugin-permission');
const crypto = require('crypto');
const constants = require('../lib/constants');
const utils = require('../lib/utils');


constants.SOLUTION_DIFFICULTY = 4;

describe('@module kadence/permission', function() {

  describe('@class PermissionSolver', function() {

    it('should discover a solution', function(done) {
      this.timeout(60000);
      const privateKey = crypto.randomBytes(32);
      const solver = new permission.PermissionSolver(privateKey);

      solver.once('data', data => {
        const { solution } = data;
        expect(solution).to.be.instanceOf(permission.PermissionSolution);
        expect(utils.satisfiesDifficulty(solution.result,
          constants.SOLUTION_DIFFICULTY)).to.equal(true);
        done();
      });
    });

  });

  describe('@class PermissionSolution', function() {

    it('should pack into a hex tuple', function() {
      const sol = new permission.PermissionSolution(
        Buffer.alloc(260).fill(0)
      );
      const packed = sol.pack();
      expect(packed[0]).to.have.lengthOf(40);
      expect(packed[1]).to.have.lengthOf(520);
    });

  });

});
