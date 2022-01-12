const { Given } = require('cucumber');
const OTNode = require('../../../ot-node');

Given(/^I setup (\d+) node[s]*$/, { timeout: 120000 }, function (nodeCount, done) {
    this.logger.log(`I setup ${nodeCount} node${nodeCount !== 1 ? 's' : ''}`);

    for (let i = 0; i < nodeCount; i += 1) {
        const nodeConfiguration = {

        };

        const newNode = new OTNode(nodeConfiguration);
        this.state.nodes.push(newNode);
        newNode.start();
        this.logger.log(`Node set up at ${newNode.options.configDir}`);
    }
    done();
});
