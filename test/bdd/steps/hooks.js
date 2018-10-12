/* eslint-disable prefer-arrow-callback */
require('dotenv').config();

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
    done();
});

After(function (testCase, done) {
    this.logger.log('Completed scenario: ', testCase.pickle.name, `${testCase.sourceLocation.uri}:${testCase.sourceLocation.line}`);
    this.logger.log('with status: ', testCase.result.status, ' and duration: ', testCase.result.duration, ' miliseconds.');

    if (testCase.result.status === 'failed') {
        this.logger.log('Oops, exception occured:');
        this.logger.log(testCase.result.exception);
    }

    // Clean.
    const nodesWaits =
        [...this.state.nodes, ...this.state.bootstraps]
            .map(node => new Promise((accept, reject) => {
                node.on('finished', (code) => {
                    if (code === 0) {
                        accept();
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

    Promise.all(nodesWaits);

    this.state.localBlockchain = null;
    this.state.nodes = [];
    this.state.bootstraps = [];

    done();
});

AfterAll(() => {
    // TODO: After-all.
    // Delete all Arango dbs.
    // Drop all data to artifacts.
});

process.on('unhandledRejection', (reason, p) => {
    console.log(`Unhandled Rejection:\n${reason.stack}`);
    process.abort();
});
