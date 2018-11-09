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
const GS1Utilities = require('../../modules/GS1Utilities');
const ImportUtilities = require('../../modules/ImportUtilities');
const awilix = require('awilix');
const rc = require('rc');
const { sha3_256 } = require('js-sha3');

const defaultConfig = require('../../config/config.json').development;
const pjson = require('../../package.json');

const logger = require('../../modules/logger');

describe('WOT Importer tests', () => {
    const databaseName = 'wot-test';
    let graphStorage;
    let systemDb;
    var wot;

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

        graphStorage = new GraphStorage(config.database, logger);
        container.register({
            logger: awilix.asValue(logger),
            gs1Utilities: awilix.asClass(GS1Utilities),
            wotImporter: awilix.asClass(WOTImporter),
            graphStorage: awilix.asValue(graphStorage),
            config: awilix.asValue(config),
        });
        await graphStorage.connect();
        wot = container.resolve('wotImporter');
    });

    describe('Parse and Import JSON files', () => {
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

        it('should parse and import JSON and calculate correct data hash import hash', async () => {
            const response = await wot
                .parse(await Utilities.fileContents(inputJsonFiles[0].args[0]));
            const { vertices, edges, data_set_id } = response;

            const classVertices = await graphStorage.findObjectClassVertices();
            vertices.push(...classVertices);

            ImportUtilities.sort(edges);
            ImportUtilities.sort(vertices);

            const payload = { edges, vertices };
            const sortedPayload = Utilities.sortObject(payload);

            const hash = Utilities.normalizeHex(sha3_256(Utilities.stringify(sortedPayload, 0)));
            assert.equal(hash, data_set_id, 'Data hash should equal dataset id');
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
