/* eslint-disable prefer-arrow-callback */
require('dotenv').config();
const { Database } = require('arangojs');
const rc = require('rc');
const rimraf = require('rimraf');
const { forEach } = require('p-iteration');

const defaultConfig = require('../../../config/config.json').development;
const pjson = require('../../../package.json');

const config = rc(pjson.name, defaultConfig);


if (process.env.NODE_ENV !== 'development') {
    console.error('This process requires to run in "development" environment. Please change NODE_ENV.');
    process.abort();
}

const {
    Before, BeforeAll, After, AfterAll,
} = require('cucumber');

BeforeAll(() => {
});

Before(function (testCase, done) {
    this.logger = console;
    this.logger.log('Starting scenario: ', testCase.pickle.name, `${testCase.sourceLocation.uri}:${testCase.sourceLocation.line}`);

    // Initialize variables
    this.state = {};
    this.state.localBlockchain = null;
    this.state.nodes = [];
    this.state.bootstraps = [];
    this.state.manualStuff = {};
    done();
});

After(function (testCase, done) {
    this.logger.log('Completed scenario: ', testCase.pickle.name, `${testCase.sourceLocation.uri}:${testCase.sourceLocation.line}`);
    this.logger.log('with status: ', testCase.result.status, ' and duration: ', testCase.result.duration, ' miliseconds.');

    if (testCase.result.status === 'failed') {
        this.logger.log('Oops, exception occurred:');
        this.logger.log(testCase.result.exception);
    }

    // Clean.
    const nodesWaits =
        [...this.state.nodes, ...this.state.bootstraps]
            .filter(node => node.isRunning)
            .map(node => new Promise((accept, reject) => {
                node.on('finished', (code) => {
                    if (code === 0) {
                        if (this.parameters.keepFailedArtifacts &&
                            testCase.result.status === 'passed') {
                            rimraf(node.options.configDir, () => accept());
                        } else {
                            accept();
                        }
                    } else {
                        reject();
                    }
                });
            }));
    this.state.nodes.forEach(node => (node.isRunning && node.stop()));
    this.state.bootstraps.forEach(node => (node.isRunning && node.stop()));
    if (this.state.localBlockchain && this.state.localBlockchain.server) {
        this.state.localBlockchain.server.close();
    }

    Promise.all(nodesWaits).then(() => {
        this.state.localBlockchain = null;
        this.state.nodes = [];
        this.state.bootstraps = [];
        done();
    }).catch((error) => {
        this.logger.error(error);
        this.state.localBlockchain = null;
        this.state.nodes = [];
        this.state.bootstraps = [];
    });
});

AfterAll(async function () {
    // Delete almost all Arango dbs.
    const systemDb = new Database();
    systemDb.useBasicAuth(config.database.username, config.database.password);

    const listOfDatabases = await systemDb.listDatabases();

    const logger = this;
    const skipDbs = ['_system', 'origintrail', 'origintrail-develop', 'origintrail-staging', 'origintrail-stable'];
    await forEach(
        listOfDatabases.filter((dbName => !skipDbs.includes(dbName))),
        async (databaseItem) => {
            try {
                await systemDb.dropDatabase(databaseItem);
            } catch (error) {
                logger.log(`Oops, failed to delete database: ${databaseItem}`);
                logger.log(error);
            }
        },
    );

    // TODO: Drop all data to artifacts.
});

process.on('unhandledRejection', (reason, p) => {
    console.log(`Unhandled Rejection:\n${reason.stack}`);
    process.abort();
});
