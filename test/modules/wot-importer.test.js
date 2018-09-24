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
const rc = require('rc');

const defaultConfig = require('../../config/config.json').development;
const pjson = require('../../package.json');


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
        const config = rc(pjson.name, defaultConfig);

        systemDb = new Database();
        systemDb.useBasicAuth(config.database.username, config.database.password);

        // Drop test database if exist.
        const listOfDatabases = await systemDb.listDatabases();
        if (listOfDatabases.includes(databaseName)) {
            await systemDb.dropDatabase(databaseName);
        }

        await systemDb.createDatabase(
            databaseName,
            [{
                username: config.database.username,
                passwd: config.database.password,
                active: true,
            }],
        );

        config.database.database = databaseName;

        // Create the container and set the injectionMode to PROXY (which is also the default).
        const container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });

        const logger = Utilities.getLogger();
        graphStorage = new GraphStorage(config.database, logger);
        container.register({
            wotImporter: awilix.asClass(WOTImporter),
            graphStorage: awilix.asValue(graphStorage),
            config: awilix.asValue(config),
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
