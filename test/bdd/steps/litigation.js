const {
    Given, Then,
} = require('cucumber');
const { expect } = require('chai');
const Database = require('arangojs');

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
