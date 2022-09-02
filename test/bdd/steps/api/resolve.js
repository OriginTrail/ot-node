const { When, Given } = require('@cucumber/cucumber');
const { expect, assert } = require('chai');
const { setTimeout } = require('timers/promises');
const sortedStringify = require('json-stable-stringify');
const requests = require('./datasets/requests.json');
const HttpApiHelper = require('../../../utilities/http-api-helper');

const httpApiHelper = new HttpApiHelper();
When(
    /^I get operation result from node (\d+) for last published assertion/,
    { timeout: 120000 },
    async function resolveCall(node) {
        this.logger.log('I call get result for the last operation');
        expect(
            !!this.state.lastPublishData,
            'Last publish data is undefined. Publish is not finalized.',
        ).to.be.equal(true);
        // const assertionIds = [this.state.lastPublishData.result.assertion.id];

        // TODO: CALLING GET RESULT WITH WRONG UAL RETURNS UNDEFINED RESULT, IT SHOULD PROBABLY RETURN A FAILED RESULT MESSAGE OR SOMETHING LIKE THAT
        try {
            const result = await this.state.nodes[node - 1].client
                .getResult(this.state.lastPublishData.UAL)
                .catch((error) => {
                    assert.fail(`Error while trying to resolve assertion. ${error}`);
                });
            const { operationId } = result.operation;

            this.state.lastResolveData = {
                nodeId: node - 1,
                operationId,
                result,
            };
        } catch (e) {
            this.logger.log(`Error while getting operation result: ${e}`);
        }
    },
);

Given(
    'I wait for last resolve to finalize',
    { timeout: 120000 },
    async function resolveFinalizeCall() {
        this.logger.log('I wait for last resolve to finalize');
        expect(
            !!this.state.lastResolveData,
            'Last resolve data is undefined. Resolve is not started.',
        ).to.be.equal(true);
        const resolveData = this.state.lastResolveData;
        let retryCount = 0;
        const maxRetryCount = 5;
        for (retryCount = 0; retryCount < maxRetryCount; retryCount += 1) {
            this.logger.log(
                `Getting resolve result for operation id: ${resolveData.operationId} on node: ${resolveData.nodeId}`,
            );
            // eslint-disable-next-line no-await-in-loop
            const resolveResult = await httpApiHelper.getOperationResult(
                this.state.nodes[resolveData.nodeId].nodeRpcUrl,
                resolveData.operationId,
            );
            this.logger.log(`Operation status: ${resolveResult.data.status}`);
            if (['COMPLETED', 'FAILED'].includes(resolveResult.data.status)) {
                this.state.lastResolveData.result = resolveResult;
                this.state.lastResolveData.status = resolveResult.data.status;
                this.state.lastResolveData.errorType = resolveResult.data.data?.errorType;
                this.logger.log(this.state.lastResolveData.errorType);
                break;
            }
            if (retryCount === maxRetryCount - 1) {
                assert.fail('Unable to get publish result');
            }
            // eslint-disable-next-line no-await-in-loop
            await setTimeout(5000);
        }
    },
);

Given(
    /Last operation finished with status: ([COMPLETED|FAILED|GetAssertionIdError]+)$/,
    { timeout: 120000 },
    async function lastResolveFinishedCall(status) {
        this.logger.log(`Last get result finished with status: ${status}`);
        expect(
            !!this.state.lastResolveData,
            'Last get result data is undefined. Get result not started.',
        ).to.be.equal(true);
        expect(
            !!this.state.lastResolveData.result,
            'Last get result data result is undefined. Get result is not finished.',
        ).to.be.equal(true);

        const resolveData = this.state.lastResolveData;
        expect(
            resolveData.errorType ?? resolveData.status,
            'Get result status validation failed',
        ).to.be.equal(status);
    },
);

Given(/Last resolve returned valid result$/, { timeout: 120000 }, async function resolveCall() {
    this.logger.log('Last resolve returned valid result');
    expect(
        !!this.state.lastResolveData,
        'Last resolve data is undefined. Resolve is not started.',
    ).to.be.equal(true);
    expect(
        !!this.state.lastResolveData.result,
        'Last publish data result is undefined. Publish is not finished.',
    ).to.be.equal(true);
    const resolveData = this.state.lastResolveData;
    expect(
        Array.isArray(resolveData.result.data),
        'Resolve result data expected to be array',
    ).to.be.equal(true);
    // todo only one element in array should be returned
    // expect(resolveData.result.data.length, 'Returned data array length').to.be.equal(1);

    const resolvedAssertion = resolveData.result.data[0].assertion.data;
    const publishedAssertion = this.state.lastPublishData.assertion;

    assert.equal(sortedStringify(publishedAssertion), sortedStringify(resolvedAssertion));
});
Given(
    /^I call get directly to ot-node (\d+) with ([^"]*)/,
    { timeout: 30000 },
    async function getFromNode(node, requestName) {
        this.logger.log(`I call get on ot-node ${node} directly`);
        expect(
            !!requests[requestName],
            `Request body with name: ${requestName} not found!`,
        ).to.be.equal(true);
        const requestBody = requests[requestName];
        // requestBody.id = this.state.lastPublishData.UAL;
        const result = await httpApiHelper.get(this.state.nodes[node - 1].nodeRpcUrl, requestBody);
        const { operationId } = result.data;
        this.state.lastResolveData = {
            nodeId: node - 1,
            operationId,
        };
    },
);
