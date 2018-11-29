/* eslint-disable no-unused-expressions */

const {
    And, But, Given, Then, When,
} = require('cucumber');
const { expect } = require('chai');
const path = require('path');
const fs = require('fs');
const { keccak_256 } = require('js-sha3');
const BN = require('bn.js');

const utilities = require('./lib/utilities');
const erc725ProfileAbi = require('../../../modules/Blockchain/Ethereum/abi/erc725');

Given(/^I manually create ERC725 identity for (\d+)[st|nd|rd|th]+ node$/, async function (nodeIndex) {
    expect(this.state.localBlockchain, 'No blockchain.').to.not.be.undefined;
    expect(nodeIndex, 'Invalid index.').to.be.within(0, this.state.nodes.length);

    const node = this.state.nodes[nodeIndex - 1];
    const nodeWallet = node.options.nodeConfiguration.node_wallet;
    const nodeWalletKey = node.options.nodeConfiguration.node_private_key;

    const identityContractInstance =
        await this.state.localBlockchain.createIdentity(nodeWallet, nodeWalletKey);
    expect(identityContractInstance._address).to.not.be.undefined;
    this.state.manualStuff.erc725Identity = identityContractInstance._address;
});

When(/^I use the created ERC725 identity in (\d+)[st|nd|rd|th]+ node$/, async function (nodeIndex) {
    expect(this.state.localBlockchain, 'No blockchain.').to.not.be.undefined;
    expect(this.state.manualStuff.erc725Identity, 'No ERC725 identity.').to.not.be.undefined;
    expect(this.state.nodes.length, 'No started nodes.').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes.').to.be.greaterThan(0);
    expect(nodeIndex, 'Invalid index.').to.be.within(0, this.state.nodes.length);

    const node = this.state.nodes[nodeIndex - 1];

    fs.writeFileSync(
        path.join(node.options.configDir, 'erc725_identity.json'),
        JSON.stringify({ identity: this.state.manualStuff.erc725Identity }),
    );
});

Then(/^the (\d+)[st|nd|rd|th]+ node should have a valid ERC725 identity/, async function (nodeIndex) {
    expect(this.state.nodes.length, 'No started nodes.').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes.').to.be.greaterThan(0);
    expect(nodeIndex, 'Invalid index.').to.be.within(0, this.state.nodes.length);

    const node = this.state.nodes[nodeIndex - 1];

    // Profile file should exist in app-data-path.
    const erc725ProfileJsonPath = path.join(node.options.configDir, 'erc725_identity.json');
    const erc725Profile = JSON.parse(fs.readFileSync(erc725ProfileJsonPath, 'utf8'));
    expect(erc725Profile).to.have.key('identity');

    const erc725ProfileAddress = erc725Profile.identity;
    const { web3 } = this.state.localBlockchain;
    const erc725Contract = new web3.eth.Contract(erc725ProfileAbi);
    erc725Contract.options.address = erc725ProfileAddress;

    const nodeWallet = node.options.nodeConfiguration.node_wallet;
    const hashedAddress = keccak_256(Buffer.from(utilities.denormalizeHex(nodeWallet), 'hex'));


    const result =
        await erc725Contract.methods.getKey(utilities.normalizeHex(hashedAddress)).call();

    expect(result).to.have.keys(['0', '1', '2', 'purposes', 'keyType', 'key']);
    expect(result.purposes).to.have.ordered.members(['1', '2', '3', '4']);
});

Then(/^the (\d+)[st|nd|rd|th]+ node should have a valid profile$/, async function (nodeIndex) {
    expect(this.state.nodes.length, 'No started nodes.').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes.').to.be.greaterThan(0);
    expect(nodeIndex, 'Invalid index.').to.be.within(0, this.state.nodes.length);

    const node = this.state.nodes[nodeIndex - 1];
    const nodeId = node.state.identity;
    // Profile file should exist in app-data-path.
    const erc725ProfileJsonPath = path.join(node.options.configDir, 'erc725_identity.json');
    const erc725Profile = JSON.parse(fs.readFileSync(erc725ProfileJsonPath, 'utf8'));
    expect(erc725Profile).to.have.key('identity');

    const erc725ProfileAddress = erc725Profile.identity;
    const result =
        await this.state.localBlockchain.profileStorageInstance
            .methods.profile(erc725ProfileAddress).call();

    expect(result.nodeId, `Got ${JSON.stringify(result)}`).to.equal(`0x${nodeId}000000000000000000000000`);
    expect(new BN(result.stake).gt(new BN(0)), `Got ${JSON.stringify(result)}`).to.be.true;
});
