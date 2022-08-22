require('dotenv').config();
const { Before, BeforeAll, After, AfterAll } = require('@cucumber/cucumber');
const slugify = require('slugify');
const fs = require('fs');
const mysql = require('mysql2');
const { RDFMimeType } = require('graphdb').http;
const { ServerClientConfig, GraphDBServerClient } = require('graphdb').server;

process.env.NODE_ENV = 'test';

BeforeAll(() => {});

Before(function beforeMethod(testCase, done) {
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

After(async function afterMethod(testCase) {
    const graphRepositoryNames = [];
    const databaseNames = [];
    for (const key in this.state.nodes) {
        this.state.nodes[key].forkedNode.kill();
        graphRepositoryNames.push(this.state.nodes[key].configuration.graphDatabase.name);
        databaseNames.push(this.state.nodes[key].configuration.operationalDatabase.databaseName);
    }
    this.state.bootstraps.forEach((node) => {
        node.forkedNode.kill();
        graphRepositoryNames.push(node.configuration.graphDatabase.name);
        databaseNames.push(node.configuration.operationalDatabase.databaseName);
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

    const con = mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: process.env.REPOSITORY_PASSWORD,
    });
    try {
        for (const item of databaseNames) {
            this.logger.log('Removing operation database: ', item);
            // eslint-disable-next-line no-await-in-loop
            await con.connect();
            const sql = `DROP DATABASE IF EXISTS \`${item}\`;`;
            // eslint-disable-next-line no-await-in-loop
            await con.promise().query(sql);
        }
    } catch (error) {
        this.logger.error('Error while removing operation database. ', error);
    }

    // delete ot-graphdb repositories
    const serverConfig = new ServerClientConfig('http://localhost:7200')
        .setTimeout(40000)
        .setHeaders({
            Accept: RDFMimeType.N_QUADS,
        })
        .setKeepAlive(true);
    const server = new GraphDBServerClient(serverConfig);
    for (const element of graphRepositoryNames) {
        this.logger.log('Removing graph repository: ', element);
        // eslint-disable-next-line no-await-in-loop
        const hasRepository = await server.hasRepository(element);
        if (hasRepository) {
            // eslint-disable-next-line no-await-in-loop
            await server.deleteRepository(element);
        }
    }
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
});

AfterAll(async () => {});

process.on('unhandledRejection', () => {
    process.abort();
});
