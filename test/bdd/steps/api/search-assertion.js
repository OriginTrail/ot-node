const { When, Then, Given } = require('@cucumber/cucumber');
const { expect, assert } = require('chai');
const utilities = require('../../../utilities/utilities');
let handlerId, searchResult, searchData, parsedKeywords, lastSearchData;

When(/^I call search request on node (\d+) with result type ([^"]*) for the keywords:*$/, { timeout: 120000 }, async function (node, resultType, keywords) {
    parsedKeywords = utilities.unpackRawTableToArray(keywords);
    const result = await this.state.nodes[node - 1].client
        .search(resultType, parsedKeywords[0]).catch((error) => {
            assert.fail(`Error while trying to search assertion. ${error}`);
        });
    expect(result.status).to.be.eql(202, 'Expected search result status is 202');
    expect(result.statusText).to.be.eql('Accepted');
    expect(result.data.handler_id).to.be.a('string');
    handlerId = result.data.handler_id;

    this.state.lastSearchData = {
        nodeId: node - 1,
        handlerId,
        keywords: parsedKeywords,
        assertion: '',
    };
});
When('I wait for last search request to finalize', { timeout: 120000 }, async function () {
    this.logger.log('I wait searching request to be finalized');
    lastSearchData = this.state.lastSearchData;

        this.logger.log(`Getting search result for handler id: ${lastSearchData.handlerId} on node: ${lastSearchData.nodeId}`);
        // eslint-disable-next-line no-await-in-loop
        searchResult = await this.state.nodes[lastSearchData.nodeId].client.getResult(lastSearchData.handlerId, 'assertions:search').catch((error) => {
            assert.fail(`Error while trying to get search result assertion. ${error}`);
        });
      this.state.lastSearchData.result = searchResult;
});
Then('The result of assertion search cannot be 0', { timeout: 120000 }, async function (){
        expect(this.state.lastSearchData.result.itemListElement.length).to.not.eql(0);
        expect(this.state.lastSearchData.result.itemCount).to.not.eql(0);
        expect(this.state.lastSearchData.result.itemCount).to.be.a('number');
        expect(this.state.lastSearchData.result.itemListElement).to.be.a('array');
})
Then('The search result should contain all valid data', { timeout: 120000 }, async function (){
    searchData = this.state.lastSearchData.result.itemListElement[0];

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
Then(/^Metadata from last search request contains the keywords: *$/, { timeout: 120000 }, async function(keywords){
    keywords = parsedKeywords;
    expect(this.state.lastSearchData.result.itemListElement[0].result.metadata.keywords).to.be.eql(keywords);
})
Then('The number of nodes that responded cannot be 0', { timeout: 120000 }, async function(){
    const nodesNumber = await this.state.lastSearchData.result.itemListElement[0].nodes;

    if (nodesNumber.length !== 0) {
        expect(nodesNumber[0]).to.have.length(46);
    } else {
        assert.fail('The number of nodes that responded is 0')
    }
})

