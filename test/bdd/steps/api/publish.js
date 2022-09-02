const { When, Given } = require('@cucumber/cucumber');
const { expect, assert } = require('chai');
const { setTimeout } = require('timers/promises');
const assertions = require('./datasets/assertions.json');
const requests = require('./datasets/requests.json');
const HttpApiHelper = require('../../../utilities/http-api-helper');

When(
    /^I call publish on node (\d+) with ([^"]*)/,
    { timeout: 120000 },
    async function publish(node, assertionName) {
        this.logger.log(`I call publish route on node ${node}`);
        expect(
            !!assertions[assertionName],
            `Assertion with name: ${assertionName} not found!`,
        ).to.be.equal(true);
        const { evmOperationalWalletPublicKey, evmOperationalWalletPrivateKey } =
            this.state.nodes[node - 1].configuration.modules.blockchain.implementation.ganache
                .config;
        const hubContract = this.state.localBlockchain.getHubAddress();
        const assertion = assertions[assertionName];
        const result = await this.state.nodes[node - 1].client
            .publish(
                assertion,
                { evmOperationalWalletPublicKey, evmOperationalWalletPrivateKey },
                hubContract,
            )
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
            status: result.operation.status,
            errorType: result.operation.errorType,
            result,
        };
    },
);
When(
    /^I call publish on ot-node (\d+) directly with ([^"]*)/,
    { timeout: 60000 },
    async function publish(node, requestName) {
        this.logger.log(`I call publish on ot-node ${node} directly`);
        expect(
            !!requests[requestName],
            `Request body with name: ${requestName} not found!`,
        ).to.be.equal(true);
        const requestBody = requests[requestName];
        const httpApiHelper = new HttpApiHelper();
        const result = await httpApiHelper.publish(
            this.state.nodes[node - 1].nodeRpcUrl,
            requestBody,
        );
        const { operationId } = result.data;
        this.state.lastPublishData = {
            nodeId: node - 1,
            operationId,
        };
    },
);

Given('I wait for last publish to finalize', { timeout: 80000 }, async function publishFinalize() {
    this.logger.log('I wait for last publish to finalize');
    expect(
        !!this.state.lastPublishData,
        'Last publish data is undefined. Publish is not started.',
    ).to.be.equal(true);
    const publishData = this.state.lastPublishData;
    let retryCount = 0;
    const maxRetryCount = 5;
    const httpApiHelper = new HttpApiHelper();
    for (retryCount = 0; retryCount < maxRetryCount; retryCount += 1) {
        this.logger.log(
            `Getting publish result for operation id: ${publishData.operationId} on node: ${publishData.nodeId}`,
        );
        // eslint-disable-next-line no-await-in-loop
        const publishResult = await httpApiHelper.getOperationResult(
            this.state.nodes[publishData.nodeId].nodeRpcUrl,
            publishData.operationId,
        );
        this.logger.log(`Operation status: ${publishResult.data.status}`);
        if (['COMPLETED', 'FAILED'].includes(publishResult.data.status)) {
            this.state.lastPublishData.result = publishResult;
            this.state.lastPublishData.status = publishResult.data.status;
            this.state.lastPublishData.errorType = publishResult.data.data?.errorType;
            break;
        }
        if (retryCount === maxRetryCount - 1) {
            assert.fail('Unable to get publish result');
        }
        // eslint-disable-next-line no-await-in-loop
        await setTimeout(5000);
    }
});

Given(
    /Last publish finished with status: ([COMPLETED|FAILED|PublishValidateAssertionError,PublishStartError]+)$/,
    { timeout: 60000 },
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
            publishData.errorType ?? publishData.status,
            'Publish result status validation failed',
        ).to.be.equal(status);
    },
);
Given(
    /I wait for (\d+) seconds and check operation status/,
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
            this.state.nodes[publishData.nodeId].nodeRpcUrl,
            publishData.operationId,
        );
    },
);
