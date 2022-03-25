const { When, Then } = require('@cucumber/cucumber');
const assert = require('assert');
const uuid = require('uuid');
const data = require('./datasets/data.json');
const utilities = require('../../../utilities/utilities');

let handlerId = '';

When(/^I call publish on node (\d+) with keywords:*$/, { timeout: 120000 }, async function (node, keywords) {
    this.logger.log('I call publish route successfully');
    keywords = utilities.unpackRawTableToArray(keywords);
    handlerId = (await this.state.nodes[node - 1].client.publish(JSON.stringify(data), keywords)).data.handler_id;
});

Then('The returned handler_id is a valid uuid', () => {
    assert.equal(uuid.validate(handlerId), true);
});
