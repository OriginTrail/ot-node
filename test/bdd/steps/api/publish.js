const { When, Given } = require('@cucumber/cucumber');
const { expect, assert } = require('chai');
const { setTimeout } = require('timers/promises');
const assertions = require('./datasets/assertions.json');
const requests = require('./datasets/requests.json');
const HttpApiHelper = require('../../../utilities/http-api-helper');

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
        // console.log(JSON.stringify(result.operation,null,2));
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
When(
    /^I call publish on ot-node (\d+) directly with ([^"]*)/,
    { timeout: 220000 },
    async function publish(node, requestName) {
        expect(
            !!requests[requestName],
            `Request body with name: ${requestName} not found!`,
        ).to.be.equal(true);
        const requestBody = requests[requestName];
        const httpApiHelper = new HttpApiHelper();
        const result = await httpApiHelper.publish(
            `http://localhost:${this.state.nodes[node - 1].configuration.rpcPort}`,
            requestBody,
        );
        const { operationId } = result.data;
        this.state.lastPublishData = {
            nodeId: node - 1,
            operationId,
        };
        // await setTimeout(15000);
        // const status = await httpApiHelper.getOperationResult(`http://localhost:${this.state.nodes[node - 1].configuration.rpcPort}`, operationId);
        // console.log(JSON.stringify(status.data,null,2));
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
        // const publishResult = await httpApiHelper.getOperationResult(`http://localhost:${this.state.nodes[publishData.nodeId].configuration.rpcPort}`, publishData.operationId);
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
    /Last publish finished with status: ([COMPLETED|FAILED|PublishValidateAssertionError]+)$/,
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
            publishData.result.data?.data.errorType
                ? publishData.result.data.data.errorType
                : publishData.result.operation.status,
            'Publish result status validation failed',
        ).to.be.equal(status);
    },
);
Given(
    /I wait for (\d+) seconds and check operationId status/,
    { timeout: 120000 },
    async function publishWait(numberOfSeconds) {
        this.logger.log(`I wait for ${numberOfSeconds} seconds`);
        expect(
            !!this.state.lastPublishData,
            'Last publish data is undefined. Publish is not started.',
        ).to.be.equal(true);
        const publishData = this.state.lastPublishData;
        const httpApiHelper = new HttpApiHelper();
        this.logger.log(
            `Getting publish result for operation id: ${publishData.operationId} on node: ${publishData.nodeId}`,
        );
        await setTimeout(numberOfSeconds * 1000);
        // eslint-disable-next-line no-await-in-loop
        this.state.lastPublishData.result = await httpApiHelper.getOperationResult(
            `http://localhost:${this.state.nodes[publishData.nodeId].configuration.rpcPort}`,
            publishData.operationId,
        );
    },
);
