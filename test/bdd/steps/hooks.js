require('dotenv').config();
const {
    Before, BeforeAll, After, AfterAll,
} = require('@cucumber/cucumber');

if (process.env.NODE_ENV !== 'development') {
    console.error('This process requires to run in "development" environment. Please change NODE_ENV.');
    process.abort();
}

BeforeAll(() => {
});

Before(function (testCase, done) {
    this.logger = console;
    // this.logger.log('Starting scenario: ', testCase.pickle.name, `${testCase.sourceLocation.uri}:${testCase.sourceLocation.line}`);
    // Initialize variables
    this.state = {};
    this.state.localBlockchain = null;
    this.state.nodes = [];
    this.state.bootstraps = [];
    this.state.manualStuff = {};
    done();
});

After(function (testCase, done) {
    this.logger.log('Completed scenario: ', testCase.pickle.name, `${testCase.gherkinDocument.uri}:${testCase.gherkinDocument.feature.location.line}`);
    this.logger.log('with status: ', testCase.result.status, ' and duration: ', testCase.result.duration, ' miliseconds.');

    if (testCase.result.status === 'failed') {
        this.logger.log('Oops, exception occurred:');
        this.logger.log(testCase.result.exception);
    }

    // Clean.
    const nodesWaits = [...this.state.nodes, ...this.state.bootstraps]
        .filter((node) => node.isRunning)
        .map((node) => new Promise((accept, reject) => {
            node.on('finished', (code) => {
                if (code === 0) {
                    if (this.parameters.keepFailedArtifacts
                            && testCase.result.status === 'passed') {
                        // rimraf(node.options.configDir, () => accept());
                    } else {
                        accept();
                    }
                } else {
                    reject();
                }
            });
        }));
    this.state.nodes.forEach((node) => (node.kill()));
    this.state.bootstraps.forEach((node) => (node.kill()));
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

AfterAll(async () => {
    // todo Delete database data
});

process.on('unhandledRejection', (reason, p) => {
    console.log(`Unhandled Rejection:\n${reason.stack}`);
    process.abort();
});
