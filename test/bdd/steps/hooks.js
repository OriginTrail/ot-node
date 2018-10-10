/* eslint-disable prefer-arrow-callback */
require('dotenv').config();

if (process.env.NODE_ENV !== 'development') {
    console.error('This process requires to run in "development" environment. Please change NODE_ENV.');
    process.abort();
}

const {
    Before, BeforeAll, After, AfterAll,
} = require('cucumber');

// TODO: After-all.
// Delete all Arango dbs.
// Drop all data to artifacts.

BeforeAll(() => {
});

Before(function (testCase, done) {
    this.logger = console;
    this.logger.log('Starting: ', testCase.pickle.name, `${testCase.sourceLocation.uri}:${testCase.sourceLocation.line}`);

    // Initialize variables
    this.state = {};
    this.state.localBlockchain = null;
    this.state.nodes = [];
    this.state.bootstraps = [];
    done();
});

After(function (testCase, done) {
    this.logger.log('Done: ', testCase.pickle.name, `${testCase.sourceLocation.uri}:${testCase.sourceLocation.line}`);

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
});

process.on('unhandledRejection', (reason, p) => {
    console.log(`Unhandled Rejection:\n${reason.stack}`);
    process.abort();
});
