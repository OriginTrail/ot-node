const { Given } = require('@cucumber/cucumber');
const assert = require('assert');

Given(/^I call info route successfully on node (\d+)/, { timeout: 120000 }, function (node, done) {
    // todo validate node number
    this.logger.log('I call info route successfully on node: ', node);
    this.state.nodes[node - 1].client.info().then((result) => {
        assert.equal(result.version.startsWith('6'), true);
        done();
    });
});

Given(/^I call publish route successfully on node (\d+) with keyword: */, { timeout: 120000 }, function (node, done) {
    this.logger.log('I call publish route successfully');
    this.state.nodes[node - 1].client.publish().then((result) => {
        // do something with result
        console.log(result);
        done();
    });
});
