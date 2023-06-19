import { Then, When } from '@cucumber/cucumber';
import { expect, assert } from 'chai';
import { readFile } from 'fs/promises';
import HttpApiHelper from '../../../utilities/http-api-helper.mjs';

const requests = JSON.parse(await readFile('test/bdd/steps/api/datasets/requests.json'));

const httpApiHelper = new HttpApiHelper();

When(
    /^I call Get on the node (\d+) for state index (\d+)/,
    { timeout: 120000 },
    async function get(node, stateIndex) {
        this.logger.log(`I call get route on the node ${node} for state index ${stateIndex}.`);

        const { UAL } = this.state.latestUpdateData;
        const result = await this.state.nodes[node - 1].client
            .getHistorical(UAL, stateIndex)
            .catch((error) => {
                assert.fail(`Error while trying to update assertion. ${error}`);
            });
        const { operationId } = result.operation;
        this.state.latestUpdateData = {
            nodeId: node - 1,
            operationId,
        };
    },
);

When(
    /^I call Get directly on the node (\d+) with ([^"]*)/,
    { timeout: 30000 },
    async function getFromNode(node, requestName) {
        this.logger.log(`I call get directly on the node ${node}`);
        expect(
            !!requests[requestName],
            `Request body with name: ${requestName} not found!`,
        ).to.be.equal(true);
        const requestBody = requests[requestName];

        try {
            const result = await httpApiHelper.get(this.state.nodes[node - 1].nodeRpcUrl, requestBody);
            const { operationId } = result.data;
            this.state.latestGetData = {
                nodeId: node - 1,
                operationId,
            };
        } catch (error) {
            this.state.latestError = error;
        }
    },
);

Then(
    /^It should fail with status code (\d+)/,
    function checkLatestError(expectedStatusCode) {
        const expectedStatusCodeInt = parseInt(expectedStatusCode, 10);
        assert(
            this.state.latestError, 
            'No error occurred'
        );
        assert(
            this.state.latestError.statusCode, 
            'No status code in error'
        );
        assert(
            this.state.latestError.statusCode === expectedStatusCodeInt, 
            `Expected request to fail with status code ${expectedStatusCodeInt}, but it failed with another code.`
        );
    },
);

When('I wait for latest Get to finalize', { timeout: 80000 }, async function getFinalize() {
    this.logger.log('I wait for latest get to finalize');
    expect(
        !!this.state.latestGetData,
        'Latest get data is undefined. Get was not started.',
    ).to.be.equal(true);
    const getData = this.state.latestGetData;
    let retryCount = 0;
    const maxRetryCount = 5;
    for (retryCount = 0; retryCount < maxRetryCount; retryCount += 1) {
        this.logger.log(
            `Getting get result for operation id: ${getData.operationId} on the node: ${getData.nodeId}`,
        );
        // eslint-disable-next-line no-await-in-loop
        const getResult = await httpApiHelper.getOperationResult(
            this.state.nodes[getData.nodeId].nodeRpcUrl,
            'get',
            getData.operationId,
        );
        this.logger.log(`Operation status: ${getResult.data.status}`);
        if (['COMPLETED', 'FAILED'].includes(getResult.data.status)) {
            this.state.latestGetData.result = getResult;
            this.state.latestGetData.status = getResult.data.status;
            this.state.latestGetData.errorType = getResult.data.data?.errorType;
            break;
        }
        if (retryCount === maxRetryCount - 1) {
            assert.fail('Unable to fetch get result');
        }
        // eslint-disable-next-line no-await-in-loop
        await setTimeout(4000);
    }
});
