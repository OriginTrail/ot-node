require('dotenv').config();
const {
    Before, BeforeAll, After, AfterAll,
} = require('@cucumber/cucumber');
const slugify = require('slugify');
const fs = require('fs');

process.env.NODE_ENV = 'test';

BeforeAll(() => {
});

Before(function (testCase, done) {
    this.logger = console;
    this.logger.log('Starting scenario: ', testCase.pickle.name, `${testCase.pickle.uri}`);
    // Initialize variables
    this.state = {};
    this.state.localBlockchain = null;
    this.state.nodes = {};
    this.state.bootstraps = [];
    this.state.manualStuff = {};
    let logDir = process.env.CUCUMBER_ARTIFACTS_DIR || '.';
    logDir += `/test/bdd/log/${slugify(testCase.pickle.name)}`;
    fs.mkdirSync(logDir, { recursive: true });
    this.state.scenarionLogDir = logDir;
    this.logger.log('Scenario logs can be found here: ', logDir);
    done();
});

After(function (testCase, done) {
    this.logger.log('Completed scenario: ', testCase.pickle.name, `${testCase.gherkinDocument.uri}:${testCase.gherkinDocument.feature.location.line}`);
    this.logger.log('with status: ', testCase.result.status, ' and duration: ', testCase.result.duration, ' miliseconds.');

    if (testCase.result.status === 'failed') {
        this.logger.log('Oops, exception occurred:');
        this.logger.log(testCase.result.exception);
    }

    for (const key in this.state.nodes) {
        this.state.nodes[key].forkedNode.kill();
    }
    this.state.bootstraps.forEach((node) => (node.forkedNode.kill()));
    if (this.state.localBlockchain) {
        if (Array.isArray(this.state.localBlockchain)) {
            for (const blockchain of this.state.localBlockchain) {
                if (blockchain.server) {
                    blockchain.server.close();
                }
            }
        } else if (this.state.localBlockchain.server) {
            this.state.localBlockchain.server.close();
        }
    }
    this.state.localBlockchain = null;
    this.state.nodes = [];
    this.state.bootstraps = [];
    done();
});

AfterAll(async () => {
    // todo Delete database data
});

process.on('unhandledRejection', (reason, p) => {
    console.log(`Unhandled Rejection:\n${reason.stack}`);
    process.abort();
});
