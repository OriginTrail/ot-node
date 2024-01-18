import { When } from '@cucumber/cucumber';
import { expect, assert } from 'chai';
import { readFile } from 'fs/promises';

const assertions = JSON.parse(await readFile('test/bdd/steps/api/datasets/assertions.json'));

When(
    /^I call Get Bid Suggestion on the node (\d+) with ([^"]*) on blockchain ([^"]*) with hashFunctionId (\d+) and scoreFunctionId (\d+)/,
    { timeout: 120000 },
    async function getBidSuggestion(node, assertionName, blockchain) {
        this.logger.log(
            `I call get bid suggestion route on the node ${node} on blockchain ${blockchain}`,
        );

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

        const publicAssertionId = await this.state.nodes[node - 1].client
            .getPublicAssertionId(assertion)
            .catch((error) => {
                assert.fail(`Error while trying to get public assertion id. ${error}`);
            });

        const sizeInBytes = await this.state.nodes[node - 1].client
            .getSizeInBytes(assertion)
            .catch((error) => {
                assert.fail(`Error while trying to get  size in bytes. ${error}`);
            });

        const options = {
            blockchain: this.state.nodes[node - 1].clientBlockchainOptions[blockchain],
            hashFunctionId,
            scoreFunctionId,
        };
        const result = await this.state.nodes[node - 1].client
            .getBidSuggestion(publicAssertionId, sizeInBytes, options)
            .catch((error) => {
                assert.fail(`Error while trying to get bid suggestion. ${error}`);
            });
        this.state.latestBidSuggestionResult = {
            nodeId: node - 1,
            publicAssertionId,
            sizeInBytes,
            assertion: assertions[assertionName],
            result,
        };
    },
);
