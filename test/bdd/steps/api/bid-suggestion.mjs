import { When } from '@cucumber/cucumber';
import { expect, assert } from 'chai';
import { readFile } from 'fs/promises';

const assertions = JSON.parse(await readFile('test/bdd/steps/api/datasets/assertions.json'));

When(
    /^I call Get Bid Suggestion on node (\d+) using parameters ([^"]*), hashFunctionId (\d+), scoreFunctionId (\d+), within blockchain ([^"]*)/,
    { timeout: 300000 },
    async function getBidSuggestionWithHashAndScore(
        node,
        assertionName,
        hashFunctionId,
        scoreFunctionId,
        blockchain,
    ) {
        this.logger.log(
            `I call get bid suggestion route on the node ${node} on blockchain ${blockchain} with hashFunctionId ${hashFunctionId} and scoreFunctionId ${scoreFunctionId}`,
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
            Number.isInteger(hashFunctionId),
            `hashFunctionId value: ${hashFunctionId} is not an integer!`,
        ).to.be.equal(true);

        expect(
            Number.isInteger(scoreFunctionId),
            `scoreFunctionId value: ${scoreFunctionId} is not an integer!`,
        ).to.be.equal(true);

        const assertion = assertions[assertionName];
        const publicAssertionMerkleRoot = await this.state.nodes[node - 1].client
            .getPublicAssertionMerkleRoot(assertion)
            .catch((error) => {
                assert.fail(`Error while trying to get public assertion id. ${error}`);
            });

        const sizeInBytes = await this.state.nodes[node - 1].client
            .getSizeInBytes(assertion)
            .catch((error) => {
                assert.fail(`Error while trying to get  size in bytes. ${error}`);
            });

        const options = {
            ...this.state.nodes[node - 1].clientBlockchainOptions[blockchain],
            hashFunctionId: hashFunctionId,
            scoreFunctionId: scoreFunctionId,
        };
        let getBidSuggestionError;
        const result = await this.state.nodes[node - 1].client
            .getBidSuggestion(publicAssertionMerkleRoot, sizeInBytes, options)
            .catch((error) => {
                getBidSuggestionError = error;
                assert.fail(`Error while trying to get bid suggestion. ${error}`);
            });
        this.state.latestBidSuggestionResult = {
            nodeId: node - 1,
            publicAssertionMerkleRoot,
            sizeInBytes,
            assertion: assertions[assertionName],
            result,
            getBidSuggestionError,
        };
    },
);

When(
    /^I call Get Bid Suggestion on the node (\d+) with ([^"]*) on blockchain ([^"]*)/,
    { timeout: 300000 },
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

        const assertion = assertions[assertionName];
        const publicAssertionMerkleRoot = await this.state.nodes[node - 1].client
            .getPublicAssertionMerkleRoot(assertion)
            .catch((error) => {
                assert.fail(`Error while trying to get public assertion id. ${error}`);
            });

        const sizeInBytes = await this.state.nodes[node - 1].client
            .getSizeInBytes(assertion)
            .catch((error) => {
                assert.fail(`Error while trying to get  size in bytes. ${error}`);
            });

        const options = this.state.nodes[node - 1].clientBlockchainOptions[blockchain];
        let getBidSuggestionError;
        const result = await this.state.nodes[node - 1].client
            .getBidSuggestion(publicAssertionMerkleRoot, sizeInBytes, options)
            .catch((error) => {
                getBidSuggestionError = error;
                assert.fail(`Error while trying to get bid suggestion. ${error}`);
            });
        this.state.latestBidSuggestionResult = {
            nodeId: node - 1,
            publicAssertionMerkleRoot,
            sizeInBytes,
            assertion: assertions[assertionName],
            result,
            getBidSuggestionError,
        };
    },
);
