import 'dotenv/config';
import { Before, BeforeAll, After, AfterAll } from '@cucumber/cucumber';
import slugify from 'slugify';
import fs from 'fs';
import mysql from 'mysql2';
import graphdb from 'graphdb';
const {http,server} = graphdb;

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

After(function afterMethod(testCase, done) {
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

    const promises = [];
    const con = mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: process.env.REPOSITORY_PASSWORD,
    });
    databaseNames.forEach((element) => {
        const sql = `DROP DATABASE IF EXISTS \`${element}\`;`;
        promises.push(con.promise().query(sql));
    });
    promises.push(con);
    const serverConfig = new server.ServerClientConfig('http://localhost:7200')
        .setTimeout(40000)
        .setHeaders({
            Accept: http.RDFMimeType.N_QUADS,
        })
        .setKeepAlive(true);
    const s = new server.GraphDBServerClient(serverConfig);
    graphRepositoryNames.forEach((element) => {
        s.hasRepository(element)
            .then((exists) => {
                if (exists) {
                    promises.push(s.deleteRepository(element));
                }
            })
            .catch((err) => this.logger.error(err));
    });

    /* try {
        for (const item of databaseNames) {
            this.logger.log('Removing operation database: ', item);
            // eslint-disable-next-line no-await-in-loop
            await con.connect();:ki
            const sql = `DROP DATABASE IF EXISTS \`${item}\`;`;
            // eslint-disable-next-line no-await-in-loop
            await con.promise().query(sql);
        }
    } catch (error) {
        this.logger.error('Error while removing operation database. ', error);
    } */
    // delete ot-graphdb repositories
    Promise.all(promises)
        .then(() => {
            con.end();
        })
        .then(() => {
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
            done();
        });
});

AfterAll(async () => {});

process.on('unhandledRejection', () => {
    process.abort();
});
