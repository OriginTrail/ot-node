const { When, Given } = require('@cucumber/cucumber');
const { expect, assert } = require('chai');
const { setTimeout } = require('timers/promises');
const assertions = require('./datasets/assertions.json');

When(
    /^I call publish on node (\d+) with ([^"]*)/,
    { timeout: 220000 },
    async function publish(node, assertionName) {
        this.logger.log('I call publish route successfully');
        expect(
            !!assertions[assertionName],
            `Assertion with name: ${assertionName} not found!`,
        ).to.be.equal(true);
        const { publicKey, privateKey } =
            this.state.nodes[node - 1].configuration.modules.blockchain.implementation.ganache
                .config;
        const hubContract = this.state.localBlockchain.uaiRegistryContractAddress();
        const assertion = assertions[assertionName];
        const result = await this.state.nodes[node - 1].client
            .publish(assertion, { publicKey, privateKey }, hubContract)
            .catch((error) => {
                assert.fail(`Error while trying to publish assertion. ${error}`);
            });
        const { operationId } = result.operation;
        this.state.lastPublishData = {
            nodeId: node - 1,
            UAL: result.UAL,
            assertionId: result.assertionId,
            operationId,
            // keywords: parsedKeywords,
            assertion: assertions[assertionName],
        };
    },
);

Given('I wait for last publish to finalize', { timeout: 120000 }, async function publishFinalize() {
    this.logger.log('I wait for last publish to finalize');
    expect(
        !!this.state.lastPublishData,
        'Last publish data is undefined. Publish is not started.',
    ).to.be.equal(true);
    const publishData = this.state.lastPublishData;
    let loopForPublishResult = true;
    let retryCount = 0;
    const maxRetryCount = 2;
    while (loopForPublishResult) {
        this.logger.log(
            `Getting publish result for operation id: ${publishData.operationId} on node: ${publishData.nodeId}`,
        );
        // eslint-disable-next-line no-await-in-loop
        const publishResult = await this.state.nodes[publishData.nodeId].client
            .getResult(publishData.UAL)
            .catch((error) => {
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
            await setTimeout(5000);
        }
    }
});

Given(
    /Last publish finished with status: ([COMPLETED|FAILED|PUBLISH_START_ERROR]+)$/,
    { timeout: 120000 },
    async function lastPublishFinished(status) {
        this.logger.log(`Last publish finished with status: ${status}`);
        expect(
            !!this.state.lastPublishData,
            'Last publish data is undefined. Publish is not started.',
        ).to.be.equal(true);
        expect(
            !!this.state.lastPublishData.result,
            'Last publish data result is undefined. Publish is not finished.',
        ).to.be.equal(true);
        const publishData = this.state.lastPublishData;
        expect(
            publishData.result.operation.status,
            'Publish result status validation failed',
        ).to.be.equal(status);
    },
);

// Then('The returned operation_id is a valid uuid', () => {
//     assert.equal(uuid.validate(operationId), true);
// });
