import { When, Given } from '@cucumber/cucumber';
import { expect, assert } from 'chai';
import { setTimeout } from 'timers/promises';
import { readFile } from 'fs/promises';
import HttpApiHelper from '../../../utilities/http-api-helper.mjs';

const assertions = JSON.parse(await readFile('test/bdd/steps/api/datasets/assertions.json'));
const requests = JSON.parse(await readFile('test/bdd/steps/api/datasets/requests.json'));

const httpApiHelper = new HttpApiHelper();

When(
    /^I call update on node (\d+) for last publish UAL with ([^"]*)/,
    { timeout: 120000 },
    async function update(node, assertionName) {
        this.logger.log(`I call update route on node ${node}`);
        expect(
            !!assertions[assertionName],
            `Assertion with name: ${assertionName} not found!`,
        ).to.be.equal(true);
        const { evmOperationalWalletPublicKey, evmOperationalWalletPrivateKey } =
            this.state.nodes[node - 1].configuration.modules.blockchain.implementation.hardhat
                .config;
        const assertion = assertions[assertionName];
        const { UAL } = this.state.lastPublishData;
        const result = await this.state.nodes[node - 1].client
            .update(UAL, assertion, { evmOperationalWalletPublicKey, evmOperationalWalletPrivateKey })
            .catch((error) => {
                assert.fail(`Error while trying to update assertion. ${error}`);
            });
        const { operationId } = result.operation;
        this.state.lastUpdateData = {
            nodeId: node - 1,
            UAL,
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
    /^I call update on ot-node (\d+) directly with ([^"]*)/,
    { timeout: 70000 },
    async function publish(node, requestName) {
        this.logger.log(`I call update on ot-node ${node} directly`);
        expect(
            !!requests[requestName],
            `Request body with name: ${requestName} not found!`,
        ).to.be.equal(true);
        const requestBody = requests[requestName];
        const result = await httpApiHelper.update(
            this.state.nodes[node - 1].nodeRpcUrl,
            requestBody,
        );
        const { operationId } = result.data;
        this.state.lastUpdateData = {
            nodeId: node - 1,
            operationId,
        };
    },
);

Given('I wait for last update to finalize', { timeout: 80000 }, async function publishFinalize() {
    this.logger.log('I wait for last update to finalize');
    expect(
        !!this.state.lastUpdateData,
        'Last update data is undefined. Update is not started.',
    ).to.be.equal(true);
    const updateData = this.state.lastUpdateData;
    let retryCount = 0;
    const maxRetryCount = 5;
    for (retryCount = 0; retryCount < maxRetryCount; retryCount += 1) {
        this.logger.log(
            `Getting Update result for operation id: ${updateData.operationId} on node: ${udpateData.nodeId}`,
        );
        // eslint-disable-next-line no-await-in-loop
        const updateResult = await httpApiHelper.getOperationResult(
            this.state.nodes[updateData.nodeId].nodeRpcUrl,
            updateData.operationId,
        );
        this.logger.log(`Operation status: ${updateResult.data.status}`);
        if (['COMPLETED', 'FAILED'].includes(updateResult.data.status)) {
            this.state.lastPublishData.result = updateResult;
            this.state.lastPublishData.status = updateResult.data.status;
            this.state.lastPublishData.errorType = updateResult.data.data?.errorType;
            break;
        }
        if (retryCount === maxRetryCount - 1) {
            assert.fail('Unable to get update result');
        }
        // eslint-disable-next-line no-await-in-loop
        await setTimeout(4000);
    }
});
