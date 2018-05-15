require('dotenv').config();
const {
    describe, before, beforeEach, after, afterEach, it,
} = require('mocha');
const gs1 = require('../../modules/gs1-importer')();
const path = require('path');
const { Database } = require('arangojs');
const GraphStorage = require('../../modules/Database/GraphStorage');
const GSInstance = require('../../modules/GraphStorageInstance');

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

describe('GS1 Importer tests', () => {
    const databaseName = 'gs1-test';
    let systemDb;

    before('Setup DB', async () => {
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

        // Setup signletons.
        GSInstance.db = new GraphStorage(buildSelectedDatabaseParam(databaseName));
        await GSInstance.db.connect();
    });

    describe('Parse XML', () => {
        const inputXmlFiles = [
            { args: [path.join(__dirname, '../../importers/Transformation.xml')] },
            { args: [path.join(__dirname, '../../importers/GraphExample_1.xml')] },
            { args: [path.join(__dirname, '../../importers/GraphExample_2.xml')] },
            { args: [path.join(__dirname, '../../importers/GraphExample_3.xml')] },
        ];

        inputXmlFiles.forEach((test) => {
            it(
                `should correctly parse and import ${path.basename(test.args[0])} file`,
                async () => gs1.parseGS1(test.args[0]),
            );
        });
    });

    after('Drop DB', async () => {
        if (systemDb) {
            const listOfDatabases = await systemDb.listDatabases();
            if (listOfDatabases.includes(databaseName)) {
                await systemDb.dropDatabase(databaseName);
            }
        }
    });
});
