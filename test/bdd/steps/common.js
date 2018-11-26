/* eslint-disable no-unused-expressions */

const {
    And, But, Given, Then, When,
} = require('cucumber');
const { expect } = require('chai');


Then(/^the (\d+)[st|nd|rd|th]+ node should start normally$/, function (nodeIndex) {
    expect(this.state.nodes.length, 'No started nodes.').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes.').to.be.greaterThan(0);
    expect(nodeIndex, 'Invalid index.').to.be.within(0, this.state.nodes.length);

    const node = this.state.nodes[nodeIndex - 1];
    expect(node.isRunning).to.be.true;
});
