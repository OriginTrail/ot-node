/* eslint-disable no-unused-expressions */
const {
    Given, Then,
} = require('cucumber');
const { expect } = require('chai');
const Database = require('arangojs');

const Models = require('../../../models');

Given(/^I stop (\d+) holder[s]*$/, { timeout: 300000 }, function (holdersToStop) {
    expect(holdersToStop).to.be.greaterThan(0);
    expect(holdersToStop).to.be.lessThan(4);
    expect(this.state.bootstraps.length).to.be.greaterThan(0);
    expect(this.state.nodes.length).to.be.greaterThan(0);

    const nodesStops = [];
    this.state.nodes.filter(node => node.state.takenBids.length > 0 && node.started === true)
        .slice(0, holdersToStop)
        .forEach((node) => {
            nodesStops.push(new Promise((accept, reject) => {
                node.once('finished', () => accept());
                node.once('error', reject);
            }));
            node.stop();
        });
    return Promise.all(nodesStops);
});

Given(/^I remember stopped holder[s]*$/, async function () {
    expect(this.state.bootstraps.length).to.be.greaterThan(0);
    expect(this.state.nodes.length).to.be.greaterThan(0);

    this.state.holdersToLitigate = this.state.nodes
        .filter(node => node.state.takenBids.length > 0 && node.started === false)
        .map(node => node.id);

    this.logger.log(`Stopped holders [${this.state.holdersToLitigate}]`);
});

Given(/^I wait for litigation initiation$/, { timeout: 300000 }, function (done) {
    expect(this.state.bootstraps.length).to.be.greaterThan(0);
    expect(this.state.nodes.length).to.be.greaterThan(0);

    const { dc } = this.state;

    dc.once('dc-litigation-initiated', () => {
        done();
    });
});

Given(/^I start (\d+)[st|nd|rd|th]+ stopped holder*$/, { timeout: 300000 }, function (nodeIndex) {
    expect(this.state.bootstraps.length).to.be.greaterThan(0);
    expect(this.state.nodes.length).to.be.greaterThan(0);

    const nodeStarts = [];
    this.state.nodes.filter(node => node.id === this.state.holdersToLitigate[nodeIndex - 1])
        .forEach((node) => {
            this.logger.log(`Starting node ${node.id}`);
            nodeStarts.push(new Promise((accept, reject) => {
                node.once('initialized', () => accept());
                node.once('error', reject);
            }));
            node.start();
        });
    return Promise.all(nodeStarts);
});

Then(/^(\d+)[st|nd|rd|th]+ holder to litigate should answer litigation$/, { timeout: 300000 }, async function (nodeIndex) {
    expect(this.state.bootstraps.length).to.be.greaterThan(0);
    expect(this.state.nodes.length).to.be.greaterThan(0);

    const answers = [];
    this.state.nodes.filter(node => node.id === this.state.holdersToLitigate[nodeIndex - 1])
        .forEach((node) => {
            this.logger.log(`Node ${node.id} should answer litigation`);
            answers.push(new Promise((accept, reject) => {
                node.once('dh-litigation-answered', () => accept());
                node.once('error', reject);
            }));
        });
    return Promise.all(answers);
});

Then(/^(\d+) holder[s]* should answer litigation$/, { timeout: 300000 }, async function (holderCount) {
    expect(holderCount).to.be.greaterThan(0);
    expect(holderCount).to.be.lessThan(4);
    expect(this.state.bootstraps.length).to.be.greaterThan(0);
    expect(this.state.nodes.length).to.be.greaterThan(0);

    const answers = [];
    this.state.nodes.filter(node => this.state.holdersToLitigate.includes(node.id))
        .forEach((node) => {
            answers.push(new Promise((accept, reject) => {
                node.once('dh-litigation-answered', () => accept());
                node.once('error', reject);
            }));
        });
    return Promise.all(answers);
});

Then(/^Litigator node should have completed litigation$/, { timeout: 300000 }, function (done) {
    this.logger.log('Litigator node should have completed litigation');

    expect(this.state.bootstraps.length).to.be.greaterThan(0);
    expect(this.state.nodes.length).to.be.greaterThan(0);

    const { dc } = this.state;

    if (dc.state.litigationStatus === 'LITIGATION_COMPLETED') {
        done();
        return;
    }

    dc.once('dc-litigation-completed', () => {
        done();
    });
});

Then(/^(\d+)[st|nd|rd|th]+ started holder should have been penalized$/, { timeout: 300000 }, function (nodeIndex, done) {
    expect(this.state.bootstraps.length).to.be.greaterThan(0);
    expect(this.state.nodes.length).to.be.greaterThan(0);

    const { dc } = this.state;

    dc.once('dc-litigation-completed-dh-penalized', () => {
        done();
    });
});

Then(/^(\d+)[st|nd|rd|th]+ started holder should not have been penalized$/, { timeout: 300000 }, function (nodeIndex, done) {
    expect(this.state.bootstraps.length).to.be.greaterThan(0);
    expect(this.state.nodes.length).to.be.greaterThan(0);

    const { dc } = this.state;

    dc.once('dc-litigation-completed-dh-not-penalized', () => {
        done();
    });
});

Then(/^Litigator should have started replacement for penalized holder[s]*$/, { timeout: 300000 }, function (done) {
    expect(this.state.bootstraps.length).to.be.greaterThan(0);
    expect(this.state.nodes.length).to.be.greaterThan(0);

    const { dc } = this.state;

    dc.once('dc-litigation-replacement-started', () => {
        done();
    });
});

Then(/^I wait for (\d+) replacement replication[s] to finish$/, { timeout: 300000 }, async function (numberOfReplications) {
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(numberOfReplications).to.be.greaterThan(0);
    expect(numberOfReplications).to.be.lessThan(this.state.nodes.length);

    const { dc } = this.state;

    const replacements = [];
    const potentialReplacements = this.state.nodes
        .filter(node => node.state.takenBids.length === 0 && node.id !== dc.id);
    expect(potentialReplacements.length).to.be.equal(numberOfReplications);

    potentialReplacements.forEach((node) => {
        replacements.push(new Promise((accept, reject) => {
            node.once('dh-litigation-replacement-received', () => accept());
            node.once('error', reject);
        }));
    });
    await Promise.all(replacements);
});

Then(/^I wait for replacement to be completed$/, { timeout: 300000 }, function (done) {
    this.logger.log('I wait for replacement to be completed...');
    expect(this.state.bootstraps.length).to.be.greaterThan(0);
    expect(this.state.nodes.length).to.be.greaterThan(0);

    const { dc } = this.state;

    dc.once('dc-litigation-replacement-completed', () => {
        done();
    });
});

Given(/^I wait for challenges to start$/, { timeout: 300000 }, async function () {
    expect(this.state.bootstraps.length).to.be.greaterThan(0);
    expect(this.state.nodes.length).to.be.greaterThan(0);

    const challenges = [];
    this.state.nodes.filter(node => node.state.takenBids.length > 0)
        .forEach((node) => {
            challenges.push(new Promise((accept, reject) => {
                node.once('dh-challenge-sent', () => accept());
                node.once('error', reject);
            }));
        });
    return Promise.all(challenges);
});

Then(/^Litigator should delay other litigations while one is running$/, { timeout: 300000 }, function (done) {
    this.logger.log('Litigator should delay other litigations while one is running');

    expect(this.state.bootstraps.length).to.be.greaterThan(0);
    expect(this.state.nodes.length).to.be.greaterThan(0);

    const { dc } = this.state;

    dc.once('dc-litigation-pending', () => {
        done();
    });
});

Given(/^I corrupt (\d+)[st|nd|rd|th]+ holder's database ot_vertices collection$/, { timeout: 300000 }, async function (nodeIndex) {
    this.logger.log(`I corrupt holder ${nodeIndex} database ot_vertices collection`);
    expect(nodeIndex).to.be.greaterThan(0);
    expect(nodeIndex).to.be.lessThan(4);
    expect(this.state.bootstraps.length).to.be.greaterThan(0);
    expect(this.state.nodes.length).to.be.greaterThan(0);

    const node = this.state.nodes.filter(node => node.state.takenBids.length > 0)[nodeIndex - 1];
    const {
        database: databaseName,
        username,
        password,
    } = node.options.nodeConfiguration.database;

    const systemDb = new Database();
    systemDb.useBasicAuth(username, password);
    systemDb.useDatabase(databaseName);

    await systemDb.query(`FOR v IN ot_vertices
            UPDATE { _key: v._key, 
                '${this.state.lastImport.data_set_id}': {
                    data:
                        REVERSE(v['${this.state.lastImport.data_set_id}'].data)
                       } 
            } IN ot_vertices`);

    this.state.holdersToLitigate.push(node);
});

Then(/^I simulate true litigation answer for (\d+)[st|nd|rd|th]+ node$/, { timeout: 300000 }, async function (nodeIndex) {
    expect(nodeIndex, 'Invalid node index').to.be.greaterThan(0);
    expect(nodeIndex, 'Invalid node index').to.be.lessThan(this.state.nodes.length + 1);
    expect(this.state.bootstraps.length, 'No running bootstraps').to.be.greaterThan(0);
    expect(this.state.nodes.length, 'No running nodes').to.be.greaterThan(0);
    expect(this.state.dc).not.to.be.undefined;

    const { localBlockchain } = this.state;
    const node = this.state.nodes[nodeIndex - 1];
    const { dc } = this.state;

    // Check if litigation started.
    // First check if event is already fired...
    let events = await localBlockchain.litigationInstance
        .getPastEvents('LitigationInitiated', {
            fromBlock: 0,
            toBlock: 'latest',
        });

    async function answerLitigation(event) {
        /*
            Example:
            {
                "0":"0xdd1e8e815acbef54fca35f61332e9e3391e00df5ed5e40e7a80b6670e41dca63",
                "1":"0xD5dDAf0d5686ACe0735256333eeddf7EB637Fe67",
                "2":"203",
                "offerId":"0xdd1e8e815acbef54fca35f61332e9e3391e00df5ed5e40e7a80b6670e41dca63",
                "holderIdentity":"0xD5dDAf0d5686ACe0735256333eeddf7EB637Fe67",
                "requestedDataIndex":"203"
            }
         */
        expect(event).to.have.keys(['0', '1', '2', 'offerId', 'holderIdentity', 'requestedDataIndex']);

        // Find node
        Models.sequelize.options.storage = dc.systemDbPath;
        await Models.sequelize.sync();
        const challenge = await Models.sequelize.models.challenges.findOne({
            where: {
                dh_id: node.state.identity,
                block_id: Number(event.requestedDataIndex),
                offer_id: event.offerId,
            },
        });

        expect(challenge).not.to.be.null;
        expect(event.holderIdentity).to.equal(node.erc725Identity);

        let result = await localBlockchain.litigationStorageInstance.methods
            .litigation(event.offerId, event.holderIdentity).call();
        expect(result.status).to.equal('1');

        const answer = Buffer.from(challenge.expected_answer, 'utf-8')
            .toString('hex')
            .padStart(64, '0');

        // Before answering, prepare DC side to catch DC's acknowledgement.
        const dcPromise = new Promise((accept) => {
            dc.once('dc-litigation-completed', () => accept());
        });

        await localBlockchain.litigationInstance.methods.answerLitigation(
            event.offerId,
            event.holderIdentity,
            `0x${answer}`,
        ).send({
            from: node.options.nodeConfiguration.node_wallet,
            gasPrice: '10000000000000',
            gas: 1000000,
        });

        result = await localBlockchain.litigationStorageInstance.methods
            .litigation(event.offerId, event.holderIdentity).call();
        expect(result.status).to.equal('2');

        return dcPromise; // Wait for litigation to complete.
    }

    if (events.length === 0) {
        // ...and if not wait for event.
        return new Promise((accept) => {
            const handle = setInterval(async () => {
                events = await localBlockchain.litigationStorageInstance
                    .getPastEvents('LitigationInitiated', {
                        fromBlock: 0,
                        toBlock: 'latest',
                    });
                if (events.length !== 0) {
                    clearInterval(handle);
                    expect(events, 'More than one LitigationInitiated received.').to.have.lengthOf(1);
                    await answerLitigation(events[0].returnValues);
                    accept();
                }
            }, 2000);
        });
    }

    expect(events, 'More than one LitigationInitiated received.').to.have.lengthOf(1);
    return answerLitigation(events[0].returnValues);
});

Then(
    /^the last offer's status for (\d+)[st|nd|rd|th]+ node should be active$/,
    { timeout: 300000 },
    async function (nodeIndex) {
        expect(nodeIndex, 'Invalid node index').to.be.greaterThan(0);
        expect(nodeIndex, 'Invalid node index').to.be.lessThan(this.state.nodes.length + 1);
        expect(this.state.bootstraps.length, 'No running bootstraps').to.be.greaterThan(0);
        expect(this.state.nodes.length, 'No running nodes').to.be.greaterThan(0);

        const { dc } = this.state;

        expect(dc).not.to.be.undefined;
        expect(dc.state.offers).not.to.be.undefined;
        expect(dc.state.offers.internalIDs).not.to.be.undefined;
        expect(this.state.lastReplication, 'Nothing replicated.').not.to.be.undefined;

        const node = this.state.nodes[nodeIndex - 1];

        const lastOfferId =
            dc.state.offers.internalIDs[this.state.lastReplication.replication_id].offerId;

        Models.sequelize.options.storage = dc.systemDbPath;
        await Models.sequelize.sync();

        const replicated_data = await Models.sequelize.models.replicated_data.findOne({
            where: {
                dh_id: node.state.identity,
                dh_identity: node.erc725Identity.toLocaleLowerCase(),
                offer_id: lastOfferId,
            },
        });

        expect(replicated_data.status).to.equal('HOLDING');

        const offer = await Models.sequelize.models.offers.findOne({
            where: {
                offer_id: lastOfferId,
                data_set_id: this.state.lastImport.data_set_id,
            },
        });

        expect(offer.global_status).to.equal('ACTIVE');
    },
);
