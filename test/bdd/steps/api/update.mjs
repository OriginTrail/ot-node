import { When } from '@cucumber/cucumber';
import { expect, assert } from 'chai';
import { setTimeout } from 'timers/promises';
import { readFile } from 'fs/promises';
import HttpApiHelper from '../../../utilities/http-api-helper.mjs';

const assertions = JSON.parse(await readFile('test/bdd/steps/api/datasets/assertions.json'));
const requests = JSON.parse(await readFile('test/bdd/steps/api/datasets/requests.json'));

const httpApiHelper = new HttpApiHelper();

When(
    /^I call Update on the node (\d+) for the latest published UAL with ([^"]*) on blockchain ([^"]*)/,
    { timeout: 120000 },
    async function update(node, assertionName, blockchain) {
        this.logger.log(`I call update route on the node ${node} on blockchain ${blockchain}`);

        expect(
            !!this.state.localBlockchains[blockchain],
            `Blockchain with name ${blockchain} not found`,
        ).to.be.equal(true);

        expect(
            !!assertions[assertionName],
            `Assertion with name: ${assertionName} not found!`,
        ).to.be.equal(true);

        const assertion = assertions[assertionName];
        const { UAL } = this.state.latestPublishData;
        const options = this.state.nodes[node - 1].clientBlockchainOptions[blockchain];
        const result = await this.state.nodes[node - 1].client
            .update(UAL, assertion, options)
            .catch((error) => {
                assert.fail(`Error while trying to update assertion. ${error}`);
            });
        const { operationId } = result.operation;
        this.state.latestUpdateData = {
            nodeId: node - 1,
            UAL,
            assertionMerkleRoot: result.assertionMerkleRoot,
            operationId,
            assertion: assertions[assertionName],
            status: result.operation.status,
            errorType: result.operation.errorType,
            result,
        };
    },
);

When(
    /^I call Update directly on the node (\d+) with ([^"]*)/,
    { timeout: 70000 },
    async function publish(node, requestName) {
        this.logger.log(`I call update on the node ${node} directly`);
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
        this.state.latestUpdateData = {
            nodeId: node - 1,
            operationId,
        };
    },
);

When('I wait for latest Update to finalize', { timeout: 80000 }, async function publishFinalize() {
    this.logger.log('I wait for latest update to finalize');
    expect(
        !!this.state.latestUpdateData,
        'Latest update data is undefined. Update was not started.',
    ).to.be.equal(true);
    const updateData = this.state.latestUpdateData;
    let retryCount = 0;
    const maxRetryCount = 5;
    for (retryCount = 0; retryCount < maxRetryCount; retryCount += 1) {
        this.logger.log(
            `Getting Update result for operation id: ${updateData.operationId} on the node: ${updateData.nodeId}`,
        );
        // eslint-disable-next-line no-await-in-loop
        const updateResult = await httpApiHelper.getOperationResult(
            this.state.nodes[updateData.nodeId].nodeRpcUrl,
            'update',
            updateData.operationId,
        );
        this.logger.log(`Operation status: ${updateResult.data.status}`);
        if (['COMPLETED', 'FAILED'].includes(updateResult.data.status)) {
            this.state.latestUpdateData.result = updateResult;
            this.state.latestUpdateData.status = updateResult.data.status;
            this.state.latestUpdateData.errorType = updateResult.data.data?.errorType;
            break;
        }
        if (retryCount === maxRetryCount - 1) {
            assert.fail('Unable to fetch update result');
        }
        // eslint-disable-next-line no-await-in-loop
        await setTimeout(4000);
    }
});

When(
    /^I call Update on the node (\d+) for the latest published UAL with ([^"]*) on blockchain ([^"]*) with hashFunctionId (\d+) and scoreFunctionId (\d+)/,
    { timeout: 120000 },
    async function update(node, assertionName, blockchain, hashFunctionId, scoreFunctionId) {
        this.logger.log(`I call update route on the node ${node} on blockchain ${blockchain}`);

        expect(
            !!this.state.localBlockchains[blockchain],
            `Blockchain with name ${blockchain} not found`,
        ).to.be.equal(true);

        expect(
            !!assertions[assertionName],
            `Assertion with name: ${assertionName} not found!`,
        ).to.be.equal(true);

        expect(
            !Number.isInteger(hashFunctionId),
            `hashFunctionId value: ${hashFunctionId} is not an integer!`,
        ).to.be.equal(true);

        expect(
            !Number.isInteger(scoreFunctionId),
            `scoreFunctionId value: ${scoreFunctionId} is not an integer!`,
        ).to.be.equal(true);

        const assertion = assertions[assertionName];
        const { UAL } = this.state.latestPublishData;
        const options = {
            blockchain: this.state.nodes[node - 1].clientBlockchainOptions[blockchain],
            hashFunctionId,
            scoreFunctionId,
        };
        const result = await this.state.nodes[node - 1].client
            .update(UAL, assertion, options)
            .catch((error) => {
                assert.fail(`Error while trying to update assertion. ${error}`);
            });
        const { operationId } = result.operation;
        this.state.latestUpdateData = {
            nodeId: node - 1,
            UAL,
            assertionMerkleRoot: result.assertionMerkleRoot,
            operationId,
            assertion: assertions[assertionName],
            status: result.operation.status,
            errorType: result.operation.errorType,
            result,
        };
    },
);
