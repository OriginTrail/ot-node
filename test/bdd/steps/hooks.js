require('dotenv').config();
const { Before, BeforeAll, After, AfterAll } = require('@cucumber/cucumber');
const slugify = require('slugify');
const fs = require('fs');
const { ServerClientConfig, GraphDBServerClient } = require('graphdb').server;

process.env.NODE_ENV = 'test';

BeforeAll(() => {});

Before(function (testCase, done) {
    this.logger = console;
    this.logger.log('Starting scenario: ', testCase.pickle.name, `${testCase.pickle.uri}`);
    // Initialize variables
    this.state = {};
    this.state.localBlockchain = null;
    this.state.nodes = {};
    this.state.bootstraps = [];
    let logDir = process.env.CUCUMBER_ARTIFACTS_DIR || '.';
    logDir += `/test/bdd/log/${slugify(testCase.pickle.name)}`;
    fs.mkdirSync(logDir, { recursive: true });
    this.state.scenarionLogDir = logDir;
    this.logger.log('Scenario logs can be found here: ', logDir);
    done();
});

After(function (testCase, done) {
    this.logger.log(
        'Completed scenario: ',
        testCase.pickle.name,
        `${testCase.gherkinDocument.uri}:${testCase.gherkinDocument.feature.location.line}`,
    );
    this.logger.log(
        'with status: ',
        testCase.result.status,
        ' and duration: ',
        testCase.result.duration,
        ' miliseconds.',
    );

    if (testCase.result.status === 'failed') {
        this.logger.log('Oops, exception occurred:');
        this.logger.log(testCase.result.exception);
    }
    const graphRepositoryNames = [];
    for (const key in this.state.nodes) {
        this.state.nodes[key].forkedNode.kill();
        graphRepositoryNames.push(this.state.nodes[key].configuration.graphDatabase.name);
    }
    this.state.bootstraps.forEach((node) => {
        node.forkedNode.kill();
        graphRepositoryNames.push(node.configuration.graphDatabase.name);
    });
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
    this.logger.log('After test hook, cleaning repositories');
    // delete ot-graphdb repositories
    const serverConfig = new ServerClientConfig('http://localhost:7200')
        .setTimeout(40000)
        .setKeepAlive(true);
    const server = new GraphDBServerClient(serverConfig);
    const promises = [];

    for (const name in graphRepositoryNames) {
        promises.push(server.deleteRepository(name));
    }
    Promise.all(promises).then(() => {
        // todo this will not delete repository we need to research more about this
        done();
    });
});

AfterAll(async () => {});

process.on('unhandledRejection', (reason, p) => {
    console.log(`Unhandled Rejection:\n${reason.stack}`);
    process.abort();
});
