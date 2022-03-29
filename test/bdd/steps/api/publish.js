const { When, Then, Given } = require('@cucumber/cucumber');
const assert = require('assert');
const uuid = require('uuid');
const { expect } = require('chai');
const data = require('./datasets/data.json');
const utilities = require('../../../utilities/utilities');
const sleep = require('sleep-async')().Promise;

When(/^I call publish on node (\d+) with keywords:*$/, { timeout: 120000 }, async function (node, keywords) {
    this.logger.log('I call publish route successfully');
    const parsedKeywords = utilities.unpackRawTableToArray(keywords);
    const assertion = JSON.stringify(data);
    const handlerId = (await this.state.nodes[node - 1].client
        .publish(assertion, parsedKeywords)).data.handler_id;

    this.state.lastPublishData = {
        nodeId: node - 1,
        handlerId,
        keywords: parsedKeywords,
        assertion,
    };
});

Given('I wait for last publish to finalize', { timeout: 120000 }, async function () {
    this.logger.log('I wait for last publish to finalize');
    expect(!!this.state.lastPublishData, 'Last publish data is undefined. Publish is not started.').to.be.equal(true);
    const publishData = this.state.lastPublishData;
    let loopForPublishResult = true;
    while (loopForPublishResult) {
        this.logger.log(`Getting publish result for handler id: ${publishData.handlerId} on node: ${publishData.nodeId}`);
        const publishResult = await this.state.nodes[publishData.nodeId].client.getResult(publishData.handlerId, 'publish');
        console.log(publishResult);
        await sleep.sleep(5000);
        loopForPublishResult = false;
    }
    //done();
});

// Then('The returned handler_id is a valid uuid', () => {
//     assert.equal(uuid.validate(handlerId), true);
// });
