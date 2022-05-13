const { When, Then, Given } = require('@cucumber/cucumber');
const { expect, assert } = require('chai');
const utilities = require('../../../utilities/utilities');
let handlerId, searchResult, searchData, parsedKeywords, publishData;

Given(/^I call search request on node (\d+) with ([^"]*) for the keywords:*$/, { timeout: 120000 }, async function (node, resultType, keywords) {
    resultType = 'assertions';
    parsedKeywords = utilities.unpackRawTableToArray(keywords);

    const result = await this.state.nodes[node - 1].client
        .search(resultType, parsedKeywords[0]).catch((error) => {
            assert.fail(`Error while trying to search assertion. ${error}`);
        });

    expect(result.status).to.be.eql(202);
    expect(result.statusText).to.be.eql('Accepted');
    expect(result.data.handler_id).to.be.a('string');
    handlerId = result.data.handler_id;

    if (handlerId === undefined) {
        assert.fail(`Error while trying to get search result for ${parsedKeywords[0]}, handler_id is ${handlerId}`);
    }
    this.state.lastPublishData = {
        nodeId: node - 1,
        handlerId,
        keywords: parsedKeywords,
        assertion: '',
    };
});
When('I wait searching request to be finalized', { timeout: 120000 }, async function () {
    this.logger.log('I wait searching request to be finalized');
    publishData = this.state.lastPublishData;

        this.logger.log(`Getting search result for handler id: ${publishData.handlerId} on node: ${publishData.nodeId}`);
        // eslint-disable-next-line no-await-in-loop
        searchResult = await this.state.nodes[publishData.nodeId].client.getResult(publishData.handlerId, 'assertions:search').catch((error) => {
            assert.fail(`Error while trying to get search result assertion. ${error}`);
        });
});
Then('The result of assertion search cannot be 0', { timeout: 120000 }, async function (){
    if (searchResult.itemListElement === []){
        assert.fail('Assertion search does not return assertions metadata! itemListElement is empty');
    } else {
        expect(searchResult.itemCount).to.not.eql(0);
        expect(searchResult.itemCount).to.be.a('number');
        expect(searchResult.itemListElement).to.be.a('array');
    }
})
Then('The searching result should contain all valid data', { timeout: 120000 }, async function (){
    searchData = searchResult.itemListElement[0];

    expect(searchData).haveOwnProperty('result');
    expect(searchData).haveOwnProperty('nodes');
    expect(searchData).haveOwnProperty('resultScore');
    expect(searchData.result.metadata.hasOwnProperty('keywords'));
    expect(searchData.result.metadata.hasOwnProperty('dataHash'));
    expect(searchData.result.metadata.hasOwnProperty('issuer'));
    expect(searchData.result.metadata.hasOwnProperty('timestamp'));
    expect(searchData.result.metadata.hasOwnProperty('type'));
    expect(searchData.result.metadata.hasOwnProperty('visibility'));
    expect(searchData.result.metadata.keywords).to.be.a('Array');
})
Then(/^I get the metadata which contains the keywords: *$/, { timeout: 120000 }, async function(keywords){
    keywords = parsedKeywords;
    expect(searchResult.itemListElement[0].result.metadata.keywords).to.be.eql(keywords);
})
Then('The number of nodes that responded cannot be 0', { timeout: 120000 }, async function(){
    const nodesNumber = await searchResult.itemListElement[0].nodes;

    if (nodesNumber.length !== 0) {
        expect(nodesNumber[0]).to.have.length(46);
    } else {
        assert.fail('The number of nodes that responded is 0')
    }
})

