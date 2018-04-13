'use strict';

const { expect } = require('chai');
const kadence = require('..');
const network = require('./fixtures/node-generator');
const permission = require('../lib/plugin-permission');
const spartacus = require('../lib/plugin-spartacus');
const path = require('path');
const os = require('os');
const constants = require('../lib/constants');
const async = require('async');
const mkdirp = require('mkdirp');
const sinon = require('sinon');


constants.SOLUTION_DIFFICULTY = 2;

describe('@module kadence/permission + @class UDPTransport', function() {

  let clock = null;
  let [node1, node2] = network(2, kadence.UDPTransport);

  before(function(done) {
    this.timeout(12000);
    clock = sinon.useFakeTimers(0);
    async.eachSeries([node1, node2], (node, next) => {
      node.spartacus = node.plugin(spartacus());

      const wallet = path.join(os.tmpdir(), 'kadence-test-wallet-' +
        node.identity.toString('hex'));

      mkdirp.sync(wallet);

      node.permission = node.plugin(permission({
        privateKey: node.spartacus.privateKey,
        walletPath: wallet
      }));

      const solver = new permission.PermissionSolver(node.spartacus.privateKey);

      solver.once('data', result => {
        node.wallet.put(result.solution);
        node.listen(node.contact.port);
        next();
      });
    }, () => {
      node1.join([node2.identity.toString('hex'), node2.contact], done);
    });
  });

  after(function() {
    clock.restore();
    process._getActiveHandles().forEach((h) => h.unref());
  })

  it('should store with a valid solution', function(done) {
    this.timeout(8000);
    const value = Buffer.from('beep boop');
    const solution = node1.wallet.get(node1.wallet.solutions[0]);
    node1.iterativeStore(solution, value, (err, total) => {
      expect(err).to.equal(null);
      expect(total).to.equal(2);
      clock.restore();
      done();
    });
  });

  it('should replicate with a valid solution', function(done) {
    this.timeout(8000);
    setImmediate(() => node2.replicate(done));
  });

  it('should find the properly replicated value', function(done) {
    const [key] = node1.wallet.get(node1.wallet.solutions[0]).pack();
    node1.iterativeFindValue(key, (err, result) => {
      expect(Buffer.compare(
        Buffer.from('beep boop'),
        Buffer.from(result.value[1], 'hex')
      ) === 0).to.equal(true);
      done();
    });
  });

});
