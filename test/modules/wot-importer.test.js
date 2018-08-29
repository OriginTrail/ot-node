require('dotenv').config();
const {
    describe, beforeEach, afterEach, it,
} = require('mocha');
const { assert, expect } = require('chai');
const path = require('path');
const { Database } = require('arangojs');
const GraphStorage = require('../../modules/Database/GraphStorage');
const WOTImporter = require('../../modules/WOTImporter.js');
const Utilities = require('../../modules/Utilities');
const awilix = require('awilix');

function buildSelectedDatabaseParam(databaseName) {
    return {
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: databaseName,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database_system: 'arango_db',
    };
}

describe('WOT Importer tests', () => {
    const databaseName = 'wot-test';
    let graphStorage;
    let systemDb;
    let wot;

    const inputJsonFiles = [
        { args: [path.join(__dirname, '../../importers/json_examples/WOT_Example_1.json')] },
        { args: [path.join(__dirname, '../../importers/json_examples/WOT_Example_2.json')] },
    ];

    beforeEach('Setup DB', async () => {
        systemDb = new Database();
        systemDb.useBasicAuth(process.env.DB_USERNAME, process.env.DB_PASSWORD);

        // Drop test database if exist.
        const listOfDatabases = await systemDb.listDatabases();
        if (listOfDatabases.includes(databaseName)) {
            await systemDb.dropDatabase(databaseName);
        }

        await systemDb.createDatabase(
            databaseName,
            [{ username: process.env.DB_USERNAME, passwd: process.env.DB_PASSWORD, active: true }],
        );

        // Create the container and set the injectionMode to PROXY (which is also the default).
        const container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });

        const logger = Utilities.getLogger();
        graphStorage = new GraphStorage(buildSelectedDatabaseParam(databaseName), logger);
        container.register({
            wotImporter: awilix.asClass(WOTImporter),
            graphStorage: awilix.asValue(graphStorage),
        });
        await graphStorage.connect();
        wot = container.resolve('wotImporter');
    });

    describe('Parse and Import JSON for n repetitive times', () => {
        const repetition = 5;
        inputJsonFiles.forEach((test) => {
            for (const i in Array.from({ length: repetition })) {
                it(
                    `should correctly parse and import ${path.basename(test.args[0])} file ${i}th time`,
                    // eslint-disable-next-line no-loop-func
                    async () => wot.parse(await Utilities.fileContents(test.args[0])),
                );
            }
        });
    });

    afterEach('Drop DB', async () => {
        if (systemDb) {
            const listOfDatabases = await systemDb.listDatabases();
            if (listOfDatabases.includes(databaseName)) {
                await systemDb.dropDatabase(databaseName);
            }
        }
    });
});
