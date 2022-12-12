import { When, Then } from '@cucumber/cucumber';
import assert from 'assert';

let info = {};

When(/^I call info route on node (\d+)/, { timeout: 120000 }, async function infoRouteCall(node) {
    // todo validate node number
    this.logger.log('I call info route on node: ', node);
    info = await this.state.nodes[node - 1].client.info();
});

Then(/^The node version should start with number (\d+)/, (number) => {
    assert.equal(info.version.startsWith(number), true);
});
