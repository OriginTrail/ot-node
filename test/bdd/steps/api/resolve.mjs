import { When } from '@cucumber/cucumber';
import { expect, assert } from 'chai';
import { setTimeout } from 'timers/promises';
import HttpApiHelper from "../../../utilities/http-api-helper.mjs";

const httpApiHelper = new HttpApiHelper()

When(
    /^I get operation result from node (\d+) for latest published assertion/,
    { timeout: 120000 },
    async function resolveCall(node) {
        this.logger.log('I call get result for the latest operation');
        expect(
            !!this.state.latestPublishData,
            'Latest publish data is undefined. Publish is not finalized.',
        ).to.be.equal(true);

        try {
            const result = await this.state.nodes[node - 1].client
                .get(this.state.latestPublishData.UAL)
                .catch((error) => {
                    assert.fail(`Error while trying to resolve assertion. ${error}`);
                });
            const { operationId } = result.operation;

            this.state.latestGetData = {
                nodeId: node - 1,
                operationId,
                result,
                status: result.operation.status,
                errorType: result.operation.data?.data.errorType,
            };
        } catch (e) {
            this.logger.log(`Error while getting operation result: ${e}`);
        }
    },
);

When(
    'I wait for latest resolve to finalize',
    { timeout: 120000 },
    async function resolveFinalizeCall() {
        this.logger.log('I wait for latest resolve to finalize');
        expect(
            !!this.state.latestGetData,
            'Latest resolve data is undefined. Resolve is not started.',
        ).to.be.equal(true);
        const resolveData = this.state.latestGetData;
        let retryCount = 0;
        const maxRetryCount = 5;
        for (retryCount = 0; retryCount < maxRetryCount; retryCount += 1) {
            this.logger.log(
                `Getting resolve result for operation id: ${resolveData.operationId} on the node: ${resolveData.nodeId}`,
            );
            // eslint-disable-next-line no-await-in-loop
            const resolveResult = await httpApiHelper.getOperationResult(
                this.state.nodes[resolveData.nodeId].nodeRpcUrl,
                'get',
                resolveData.operationId,
            );
            this.logger.log(`Operation status: ${resolveResult.data.status}`);
            if (['COMPLETED', 'FAILED'].includes(resolveResult.data.status)) {
                this.state.latestGetData.result = resolveResult;
                this.state.latestGetData.status = resolveResult.data.status;
                this.state.latestGetData.errorType = resolveResult.data.data?.errorType;
                break;
            }
            if (retryCount === maxRetryCount - 1) {
                assert.fail('Unable to get GET result');
            }
            // eslint-disable-next-line no-await-in-loop
            await setTimeout(4000);
        }
    },
);

When(/Latest resolve returned valid result$/, { timeout: 120000 }, async function resolveCall() {
    this.logger.log('Latest resolve returned valid result');
    expect(
        !!this.state.latestGetData,
        'Latest resolve data is undefined. Resolve is not started.',
    ).to.be.equal(true);
    expect(
        !!this.state.latestGetData.result,
        'Latest publish data result is undefined. Publish is not finished.',
    ).to.be.equal(true);
    const resolveData = this.state.latestGetData;
    expect(
        Array.isArray(resolveData.result.data),
        'Resolve result data expected to be array',
    ).to.be.equal(true);
    // todo only one element in array should be returned
    // expect(resolveData.result.data.length, 'Returned data array length').to.be.equal(1);

    // const resolvedAssertion = resolveData.result.data[0].assertion.data;
    // const publishedAssertion = this.state.latestPublishData.assertion;

    // assert.equal(sortedStringify(publishedAssertion), sortedStringify(resolvedAssertion));
});
