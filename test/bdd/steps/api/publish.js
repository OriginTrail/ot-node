const { When, Then, Given } = require('@cucumber/cucumber');
const { expect, assert } = require('chai');
const sleep = require('sleep-async')().Promise;
const assertions = require('./datasets/assertions.json');
const utilities = require('../../../utilities/utilities');

When(/^I call publish on node (\d+) with ([^"]*) with keywords:*$/, { timeout: 120000 }, async function (node, assertionName, keywords) {
    this.logger.log('I call publish route successfully');
    expect(!!assertions[assertionName], `Assertion with name: ${assertionName} not found!`).to.be.equal(true);

    const parsedKeywords = utilities.unpackRawTableToArray(keywords);
    const assertion = JSON.stringify(assertions[assertionName]);
    const result = await this.state.nodes[node - 1].client
        .publish(assertion, parsedKeywords).catch((error) => {
            assert.fail(`Error while trying to publish assertion. ${error}`);
        });
    const handlerId = result.data.handler_id;

    this.state.lastPublishData = {
        nodeId: node - 1,
        handlerId,
        keywords: parsedKeywords,
        assertion: assertions[assertionName],
    };
});

Given('I wait for last publish to finalize', { timeout: 120000 }, async function () {
    this.logger.log('I wait for last publish to finalize');
    expect(!!this.state.lastPublishData, 'Last publish data is undefined. Publish is not started.').to.be.equal(true);
    const publishData = this.state.lastPublishData;
    let loopForPublishResult = true;
    let retryCount = 0;
    const maxRetryCount = 2;
    while (loopForPublishResult) {
        this.logger.log(`Getting publish result for handler id: ${publishData.handlerId} on node: ${publishData.nodeId}`);
        // eslint-disable-next-line no-await-in-loop
        const publishResult = await this.state.nodes[publishData.nodeId].client.getResult(publishData.handlerId, 'publish').catch((error) => {
            assert.fail(`Error while trying to get publish result assertion. ${error}`);
        });
        if (publishResult) {
            this.state.lastPublishData.result = publishResult;
            loopForPublishResult = false;
        }
        if (retryCount === maxRetryCount) {
            loopForPublishResult = true;
            assert.fail('Unable to get publish result');
        } else {
            retryCount += 1;
            // eslint-disable-next-line no-await-in-loop
            await sleep.sleep(5000);
        }
    }
});

Given(/Last publish finished with status: ([COMPLETED|FAILED]+)$/, { timeout: 120000 }, async function (status) {
    this.logger.log(`Last publish finished with status: ${status}`);
    expect(!!this.state.lastPublishData, 'Last publish data is undefined. Publish is not started.').to.be.equal(true);
    expect(!!this.state.lastPublishData.result, 'Last publish data result is undefined. Publish is not finished.').to.be.equal(true);
    const publishData = this.state.lastPublishData;
    expect(publishData.result.status, 'Publish result status validation failed').to.be.equal(status);
});

// Then('The returned handler_id is a valid uuid', () => {
//     assert.equal(uuid.validate(handlerId), true);
// });
