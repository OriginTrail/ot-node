require('dotenv').config();
const {
    describe, before, beforeEach, after, afterEach, it,
} = require('mocha');
var { expect } = require('chai');
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
    const inputXmlFiles = [
        { args: [path.join(__dirname, '../../importers/Transformation.xml')] },
        { args: [path.join(__dirname, '../../importers/GraphExample_1.xml')] },
        { args: [path.join(__dirname, '../../importers/GraphExample_2.xml')] },
        { args: [path.join(__dirname, '../../importers/GraphExample_3.xml')] },
    ];

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
        inputXmlFiles.forEach((test) => {
            it(
                `should correctly parse and import ${path.basename(test.args[0])} file`,
                async () => gs1.parseGS1(test.args[0]),
            );
        });

        inputXmlFiles.forEach((test) => {
            it(
                `should correctly parse and import ${path.basename(test.args[0])} file 2nd time`,
                async () => gs1.parseGS1(test.args[0]),
            );
        });
    });

    describe('Graph validation', async () => {
        inputXmlFiles.forEach((test) => {
            it(
                `should generate the same graph for subsequent ${path.basename(test.args[0])} imports`,
                async () => {
                    const import1Result = await gs1.parseGS1(test.args[0]);
                    const import2Result = await gs1.parseGS1(test.args[0]);

                    expect(import1Result.root_hash).to.be
                        .equal(import2Result.root_hash);
                    expect(import1Result.total_documents).to.be
                        .equal(import2Result.total_documents);
                    expect(import1Result.vertices.length).to.be
                        .equal(import2Result.vertices.length);
                    expect(import1Result.edges.length).to.be
                        .equal(import2Result.edges.length);

                    import1Result.forEach((vertex) => {
                        const vertex2 = import2Result
                            .findOne(element => vertex._key === element._key);
                        expect(vertex2).not.to.be.undefined();

                        if (vertex.identifiers) {
                            expect(vertex.identifiers).to.be.deepEqual(vertex2.identifiers);
                        }
                        if (vertex.data) {
                            expect(vertex.data).to.be.deepEqual(vertex2.data);
                        }
                        if (vertex.vertex_type) {
                            expect(vertex.vertex_type).to.be.deepEqual(vertex2.vertex_type);
                        }
                    });
                },
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
