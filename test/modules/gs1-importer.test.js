require('dotenv').config();
const {
    describe, beforeEach, afterEach, it,
} = require('mocha');
const { expect } = require('chai');
const path = require('path');
const { Database } = require('arangojs');
const GraphStorage = require('../../modules/Database/GraphStorage');
const GS1Importer = require('../../modules/GS1Importer');
const WOTImporter = require('../../modules/WOTImporter');
const Importer = require('../../modules/importer');
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

describe('GS1 Importer tests', () => {
    const databaseName = 'gs1-test';
    let systemDb;
    let gs1;
    let importer;

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

        // Create the container and set the injectionMode to PROXY (which is also the default).
        const container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });

        const graphStorage = new GraphStorage(buildSelectedDatabaseParam(databaseName));
        container.register({
            gs1Importer: awilix.asClass(GS1Importer),
            graphStorage: awilix.asValue(graphStorage),
            importer: awilix.asClass(Importer),
            wotImporter: awilix.asClass(WOTImporter),
        });
        await graphStorage.connect();
        gs1 = container.resolve('gs1Importer');
        importer = container.resolve('importer');
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

            expect(import1Result.edges.length).to.be
                .equal(import2Result.edges.length);

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

        function checkProcessedResults(processedResult1, processedResult2) {
            expect(processedResult1.root_hash).to.be.equal(processedResult2.root_hash);
        }

        inputXmlFiles.forEach((test) => {
            it(
                `should generate the same graph for subsequent ${path.basename(test.args[0])} imports`,
                async () => {
                    const import1Result = await gs1.parseGS1(test.args[0]);
                    const import2Result = await gs1.parseGS1(test.args[0]);
                    checkImportResults(import1Result, import2Result);

                    const processedResult1 = await importer.afterImport(import1Result);
                    const processedResult2 = await importer.afterImport(import2Result);
                    checkProcessedResults(processedResult1, processedResult2);
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
