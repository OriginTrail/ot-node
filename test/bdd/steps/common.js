const { Given } = require('@cucumber/cucumber');
const assert = require('assert');
const OTNode = require('../../../ot-node');
const HttpApiHelper = require('../../utilities/http-api-helper');

Given(/^I setup (\d+) node[s]*$/, { timeout: 120000 }, function (nodeCount, done) {
    this.logger.log(`I setup ${nodeCount} node${nodeCount !== 1 ? 's' : ''}`);

    const promises = [];
    for (let i = 0; i < nodeCount; i += 1) {
        const nodeConfiguration = {};

        const newNode = new OTNode(nodeConfiguration);
        this.state.nodes.push(newNode);
        promises.push(newNode.start());
    }
    Promise.all(promises).then(() => {
        done();
    });
});

Given(/^I call info route successfully/, { timeout: 120000 }, function (done) {
    this.logger.log('I call info route successfully');
    const apiHelper = new HttpApiHelper();
    apiHelper.info('http://localhost:8900').then((result) => {
        assert.equal(result.version.startsWith('6'), true);
        done();
    });
});
