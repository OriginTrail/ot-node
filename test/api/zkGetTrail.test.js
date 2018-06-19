require('dotenv').config();
const {
    describe, beforeEach, afterEach, it,
} = require('mocha');
const { assert, expect } = require('chai');
const path = require('path');
const { Database } = require('arangojs');
const GraphStorage = require('../../modules/Database/GraphStorage');
const GS1Importer = require('../../modules/GS1Importer');
const GS1Utilities = require('../../modules/GS1Utilities');
const WOTImporter = require('../../modules/WOTImporter');
const Importer = require('../../modules/importer');
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

describe('Check ZK by quering /api/trail for EVENT vertices', () => {
    const databaseName = 'zk-test';
    let graphStorage;
    let systemDb;
    let gs1;
    let importer;

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
            logger: awilix.asValue(Utilities.getLogger()),
            gs1Importer: awilix.asClass(GS1Importer),
            gs1Utilities: awilix.asClass(GS1Utilities),
            graphStorage: awilix.asValue(graphStorage),
            importer: awilix.asClass(Importer),
            wotImporter: awilix.asClass(WOTImporter),
        });
        await graphStorage.connect();
        gs1 = container.resolve('gs1Importer');
        importer = container.resolve('importer');
    });

    it('on the example of GraphExample_2.xml', () => {
        console.log('Hello there');
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
