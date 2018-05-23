require('dotenv').config();
const {
    describe, beforeEach, afterEach, it,
} = require('mocha');
const { expect } = require('chai');
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
        function checkImportResults(import1Result, import2Result) {
            expect(import1Result.root_hash).to.be
                .equal(import2Result.root_hash);
            expect(import1Result.total_documents).to.be
                .equal(import2Result.total_documents);
            expect(import1Result.vertices.length).to.be
                .equal(import2Result.vertices.length);

            const filteredEdges1 = import1Result.edges.filter(edge => edge.edge_type !== 'EVENT_CONNECTION');
            const filteredEdges2 = import2Result.edges.filter(edge => edge.edge_type !== 'EVENT_CONNECTION');

            expect(filteredEdges1.length).to.be
                .equal(filteredEdges2.length);

            import1Result.vertices.forEach((vertex) => {
                const vertex2 = import2Result.vertices
                    .find(element => vertex._key === element._key);
                expect(vertex2).not.to.be.equal(undefined);

                if (vertex.identifiers) {
                    expect(vertex.identifiers).to.deep.equal(vertex2.identifiers);
                }
                if (vertex.data) {
                    expect(vertex.data).to.deep.equal(vertex2.data);
                }
                if (vertex.vertex_type) {
                    expect(vertex.vertex_type).to.deep.equal(vertex2.vertex_type);
                }
            });
        }

        inputXmlFiles.forEach((test) => {
            it(
                `should generate the same graph for subsequent ${path.basename(test.args[0])} imports`,
                async () => {
                    const import1Result = await gs1.parseGS1(test.args[0]);
                    const import2Result = await gs1.parseGS1(test.args[0]);
                    checkImportResults(import1Result, import2Result);
                },
            );
        });

        it('should correctly import all examples together', async () => {
            const importResults = [];
            const imports = [];

            imports.push(...inputXmlFiles);
            imports.push(...inputXmlFiles);

            for (let i = 0; i < imports.length; i += 1) {
                // eslint-disable-next-line no-await-in-loop
                const result = await gs1.parseGS1(imports[i].args[0]);
                importResults.push(result);
            }

            for (let i = 0; i < inputXmlFiles.length; i += 1) {
                checkImportResults(importResults[i], importResults[i + inputXmlFiles.length]);
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
