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
    const nodeManagementWallet = node.options.nodeConfiguration.management_wallet;

    const identityContractInstance =
        await this.state.localBlockchain.createIdentity(
            nodeWallet,
            nodeWalletKey,
            nodeManagementWallet,
        );
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
        await this.state.localBlockchain.contracts.ProfileStorage.instance
            .methods.profile(erc725ProfileAddress).call();

    expect(result.nodeId, `Got ${JSON.stringify(result)}`).to.equal(`0x${nodeId}000000000000000000000000`);
    expect(new BN(result.stake).gt(new BN(0)), `Got ${JSON.stringify(result)}`).to.be.true;
});

When(/^I set up the (\d+)[st|nd|rd|th]+ node as the parent of the (\d+)[st|nd|rd|th]+ node$/, async function (parentIndex, nodeIndex) {
    expect(this.state.localBlockchain, 'No blockchain.').to.not.be.undefined;
    expect(this.state.nodes.length, 'No started nodes.').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes.').to.be.greaterThan(0);
    expect(parentIndex, 'Invalid parent index.').to.be.within(0, this.state.nodes.length);
    expect(nodeIndex, 'Invalid index.').to.be.within(0, this.state.nodes.length);

    const subidentityIndex = new BN(237);

    const parentNode = this.state.nodes[parentIndex - 1];
    const node = this.state.nodes[nodeIndex - 1];

    const parentNodeWallet = parentNode.options.nodeConfiguration.node_wallet;

    // Profile file should exist in app-data-path.
    const erc725ProfileJsonPath = path.join(node.options.configDir, 'erc725_identity.json');
    const erc725Profile = JSON.parse(fs.readFileSync(erc725ProfileJsonPath, 'utf8'));
    expect(erc725Profile).to.have.key('identity');

    // Parent profile file should exist in app-data-path.
    const parentErc725ProfileJsonPath = path.join(parentNode.options.configDir, 'erc725_identity.json');
    const parentErc725Profile = JSON.parse(fs.readFileSync(parentErc725ProfileJsonPath, 'utf8'));
    expect(parentErc725Profile).to.have.key('identity');

    const parentErc725ProfileAddress = parentErc725Profile.identity;
    const { web3 } = this.state.localBlockchain;
    const parentErc725Contract = new web3.eth.Contract(erc725ProfileAbi);
    parentErc725Contract.options.address = parentErc725ProfileAddress;

    const nodeIdentity = erc725Profile.identity;
    const hashedIdentity = keccak_256(Buffer.from(utilities.denormalizeHex(nodeIdentity), 'hex'));

    const result = await parentErc725Contract.methods
        .addKey(
            utilities.normalizeHex(hashedIdentity),
            [subidentityIndex],
            new BN(1),
        ).send({ from: parentNodeWallet, gas: 3000000 });
    expect(result).to.include.key('events');
    expect(result.events).to.have.key('KeyAdded');
    expect(result.events.KeyAdded).to.include.key('returnValues');
    expect(result.events.KeyAdded.returnValues).to.include.keys(['key', 'purposes', 'keyType']);
    expect(result.events.KeyAdded.returnValues.key).to
        .equal(utilities.normalizeHex(hashedIdentity));
    expect(result.events.KeyAdded.returnValues.purposes).to.deep
        .equal([subidentityIndex.toString()]);
    expect(result.events.KeyAdded.returnValues.keyType).to.equal('1');
});


When(/^I add the (\d+)[st|nd|rd|th]+ node erc identity as the parent in the (\d+)[st|nd|rd|th]+ node config$/, async function (parentIndex, nodeIndex) {
    expect(this.state.localBlockchain, 'No blockchain.').to.not.be.undefined;
    expect(this.state.nodes.length, 'No started nodes.').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes.').to.be.greaterThan(0);
    expect(parentIndex, 'Invalid parent index.').to.be.within(0, this.state.nodes.length);
    expect(nodeIndex, 'Invalid index.').to.be.within(0, this.state.nodes.length);

    const subidentityIndex = new BN(237);

    const parentNode = this.state.nodes[parentIndex - 1];
    const node = this.state.nodes[nodeIndex - 1];

    const parentNodeWallet = parentNode.options.nodeConfiguration.node_wallet;

    // Profile file should exist in app-data-path.
    const erc725ProfileJsonPath = path.join(node.options.configDir, 'erc725_identity.json');
    const erc725Profile = JSON.parse(fs.readFileSync(erc725ProfileJsonPath, 'utf8'));
    expect(erc725Profile).to.have.key('identity');

    // Parent profile file should exist in app-data-path.
    const parentErc725ProfileJsonPath = path.join(parentNode.options.configDir, 'erc725_identity.json');
    const parentErc725Profile = JSON.parse(fs.readFileSync(parentErc725ProfileJsonPath, 'utf8'));
    expect(parentErc725Profile).to.have.key('identity');

    const parentIdentity = parentErc725Profile.identity;

    node.overrideConfiguration({ parentIdentity });
});


Then(/^the (\d+)[st|nd|rd|th]+ node should have a management wallet/, async function (nodeIndex) {
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

    const managementWallet = await erc725Contract.methods.getKeysByPurpose(1).call();
    expect(managementWallet.length).to.be.greaterThan(0);
    expect(managementWallet[0]).to.be.not.null;
});


Then(/^the (\d+)[st|nd|rd|th]+ node should have a valid management wallet/, async function (nodeIndex) {
    expect(this.state.nodes.length, 'No started nodes.').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes.').to.be.greaterThan(0);
    expect(nodeIndex, 'Invalid index.').to.be.within(0, this.state.nodes.length);

    const node = this.state.nodes[nodeIndex - 1];
    const nodeManagementWallet = node.options.nodeConfiguration.management_wallet;
    const hashedAddress = keccak_256(Buffer.from(utilities.denormalizeHex(nodeManagementWallet), 'hex'));

    // Profile file should exist in app-data-path.
    const erc725ProfileJsonPath = path.join(node.options.configDir, 'erc725_identity.json');
    const erc725Profile = JSON.parse(fs.readFileSync(erc725ProfileJsonPath, 'utf8'));
    expect(erc725Profile).to.have.key('identity');

    const erc725ProfileAddress = erc725Profile.identity;
    const { web3 } = this.state.localBlockchain;
    const erc725Contract = new web3.eth.Contract(erc725ProfileAbi);
    erc725Contract.options.address = erc725ProfileAddress;

    const managementWallet = await erc725Contract.methods.getKeysByPurpose(1).call();
    expect(managementWallet.length).to.be.greaterThan(0);
    expect(managementWallet[0]).to.equal(`0x${hashedAddress}`);
});


Then(/^the (\d+)[st|nd|rd|th]+ node should have a default management wallet/, async function (nodeIndex) {
    expect(this.state.nodes.length, 'No started nodes.').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes.').to.be.greaterThan(0);
    expect(nodeIndex, 'Invalid index.').to.be.within(0, this.state.nodes.length);

    const node = this.state.nodes[nodeIndex - 1];
    const nodeWallet = node.options.nodeConfiguration.node_wallet;
    const hashedAddress = keccak_256(Buffer.from(utilities.denormalizeHex(nodeWallet), 'hex'));

    // Profile file should exist in app-data-path.
    const erc725ProfileJsonPath = path.join(node.options.configDir, 'erc725_identity.json');
    const erc725Profile = JSON.parse(fs.readFileSync(erc725ProfileJsonPath, 'utf8'));
    expect(erc725Profile).to.have.key('identity');

    const erc725ProfileAddress = erc725Profile.identity;
    const { web3 } = this.state.localBlockchain;
    const erc725Contract = new web3.eth.Contract(erc725ProfileAbi);
    erc725Contract.options.address = erc725ProfileAddress;

    const purposes = [1, 2, 3, 4];

    await Promise.all(purposes.map(async (p) => {
        const managementWallet = await erc725Contract.methods.getKeysByPurpose(p).call();
        expect(managementWallet.length).to.be.equal(1);
        expect(managementWallet[0]).to.equal(`0x${hashedAddress}`);
    }));
});

