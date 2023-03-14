import { When, Given } from '@cucumber/cucumber';
import { expect, assert } from 'chai';
import { setTimeout } from 'timers/promises';
import { readFile } from 'fs/promises';
import HttpApiHelper from '../../../utilities/http-api-helper.mjs';

const assertions = JSON.parse(await readFile('test/bdd/steps/api/datasets/assertions.json'));
const requests = JSON.parse(await readFile('test/bdd/steps/api/datasets/requests.json'));

const httpApiHelper = new HttpApiHelper();

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
            this.state.nodes[node - 1].configuration.modules.blockchain.implementation.hardhat
                .config;
        const assertion = assertions[assertionName];
        const result = await this.state.nodes[node - 1].client
            .publish(assertion, { evmOperationalWalletPublicKey, evmOperationalWalletPrivateKey })
            .catch((error) => {
                assert.fail(`Error while trying to publish assertion. ${error}`);
            });
        const { operationId } = result.operation;
        this.state.lastPublishData = {
            nodeId: node - 1,
            UAL: result.UAL,
            assertionId: result.assertionId,
            operationId,
            assertion: assertions[assertionName],
            status: result.operation.status,
            errorType: result.operation.errorType,
            result,
        };
    },
);
When(
    /^I call publish on ot-node (\d+) directly with ([^"]*)/,
    { timeout: 70000 },
    async function publish(node, requestName) {
        this.logger.log(`I call publish on ot-node ${node} directly`);
        expect(
            !!requests[requestName],
            `Request body with name: ${requestName} not found!`,
        ).to.be.equal(true);
        const requestBody = requests[requestName];
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
        await setTimeout(4000);
    }
});

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
