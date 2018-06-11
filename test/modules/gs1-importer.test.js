require('dotenv').config();
const {
    describe, beforeEach, afterEach, it,
} = require('mocha');
const { assert, expect } = require('chai');
const path = require('path');
const { Database } = require('arangojs');
const GraphStorage = require('../../modules/Database/GraphStorage');
const GS1Importer = require('../../modules/GS1Importer');
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
    let graphStorage;
    let systemDb;
    let gs1;

    const inputXmlFiles = [
        { args: [path.join(__dirname, '../../importers/xml_examples/Transformation.xml')] },
        { args: [path.join(__dirname, '../../importers/xml_examples/GraphExample_1.xml')] },
        { args: [path.join(__dirname, '../../importers/xml_examples/GraphExample_2.xml')] },
        { args: [path.join(__dirname, '../../importers/xml_examples/GraphExample_3.xml')] },
        { args: [path.join(__dirname, '../../importers/xml_examples/GraphExample_4.xml')] },
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

        graphStorage = new GraphStorage(buildSelectedDatabaseParam(databaseName));
        container.register({
            gs1Importer: awilix.asClass(GS1Importer),
            graphStorage: awilix.asValue(graphStorage),
        });
        await graphStorage.connect();
        gs1 = container.resolve('gs1Importer');
    });

    describe('Parse and import XML file for n times', () => {
        const repetition = 10;
        inputXmlFiles.forEach((test) => {
            for (const i in Array.from({ length: repetition })) {
                it(
                    `should correctly parse and import ${path.basename(test.args[0])} file ${i}th time`,
                    // eslint-disable-next-line no-loop-func
                    async () => gs1.parseGS1(test.args[0]),
                );
            }
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
                let vertex2;
                if (vertex.identifiers) {
                    // private data is changing the _key
                    vertex2 = import2Result.vertices.find((element) => {
                        if (element.identifiers &&
                            vertex.identifiers.id === element.identifiers.id) {
                            return element;
                        }
                        return null;
                    });
                } else {
                    // find by _key
                    vertex2 = import2Result.vertices.find(element => vertex._key === element._key);
                }

                expect(vertex2).not.to.be.equal(undefined);

                if (vertex.identifiers) {
                    expect(vertex.identifiers).to.deep.equal(vertex2.identifiers);
                }
                if (vertex.data) {
                    delete vertex.data.private;
                    delete vertex2.data.private;
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

    describe('Random vertices content and traversal path check', async () => {
        let specificVertice;

        async function checkTransformationXmlVerticeContent() {
            specificVertice = await graphStorage.findVertexWithMaxVersion('CARENGINES_PROVIDER_ID', 'urn:ot:mda:product:id:123AB');
            assert.equal(specificVertice.data.category, 'Engine');
            assert.equal(specificVertice.data.description, 'Airplane Engine for Boing');
            assert.equal(specificVertice.data.object_class_id, 'Product');
            assert.equal(specificVertice.vertex_type, 'PRODUCT');
            assert.equal(specificVertice.sender_id, 'CARENGINES_PROVIDER_ID');
            assert.equal(specificVertice.identifiers.id, 'urn:ot:mda:product:id:123AB');
            assert.equal(specificVertice.identifiers.uid, 'urn:ot:mda:product:id:123AB');
        }

        async function checkGraphExample1XmlVerticeContent() {
            specificVertice = await graphStorage.findVertexWithMaxVersion('urn:ot:mda:actor:id:Company_1', 'urn:epc:id:sgln:Building_2');
            assert.equal(specificVertice.data.category, 'Building _2');
            assert.equal(specificVertice.data.description, 'Description of building _2');
            assert.equal(specificVertice.data.object_class_id, 'Location');
            assert.equal(specificVertice.vertex_type, 'LOCATION');
            assert.equal(specificVertice.sender_id, 'urn:ot:mda:actor:id:Company_1');
            assert.equal(specificVertice.identifiers.id, 'urn:epc:id:sgln:Building_2');
            assert.equal(specificVertice.identifiers.uid, 'urn:epc:id:sgln:Building_2');
        }

        async function checkGraphExample1XmlTraversalPath() {
            // getting keys of all 12 nodes that should be in Batch_1 traversal data
            let myKey;
            const sender_id = 'urn:ot:mda:actor:id:Company_1';
            const expectedKeys = [];
            const Batch_1 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:epc:id:sgtin:Batch_1');
            const Location_Building_1 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:epc:id:sgln:Building_1');
            const Location_Building_2 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:epc:id:sgln:Building_2');
            const Actor_Company_1 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:ot:mda:actor:id:Company_1');
            const Actor_Company_2 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:ot:mda:actor:id:Company_2');
            const Event_Company_1 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:ot:mda:actor:id:Company_1:2015-04-17T00:00:00.000-04:00Z-04:00');
            const Product_1 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:ot:mda:product:id:Product_1');
            const nodes = [Product_1, Batch_1, Location_Building_1,
                Location_Building_2, Actor_Company_1, Actor_Company_2, Event_Company_1];

            nodes.forEach((node) => {
                myKey = node._key;
                expectedKeys.push(myKey);
            });
            expectedKeys.push('Transport');
            expectedKeys.push('Ownership');
            expectedKeys.push('Product');
            expectedKeys.push('Actor');
            expectedKeys.push('Location');

            const path = await graphStorage.findTraversalPath(Batch_1, 200);

            // there should be 12 node in traversal for this start vertex
            assert.equal(Object.keys(path.data).length, 12);

            const keysFromTraversal = Object.keys(path.data);
            // make sure that all _keys match
            assert.sameMembers(keysFromTraversal, expectedKeys);
        }

        async function checkGraphExample2XmlVerticeContent() {
            specificVertice = await graphStorage.findVertexWithMaxVersion('SENDER_ID', 'urn:epc:id:sgtin:Batch_2');
            assert.equal(specificVertice.data.expirationdate, '2018-04-03T00:01:54Z');
            assert.equal(specificVertice.data.parent_id, 'urn:ot:mda:product:id:Product_1');
            assert.equal(specificVertice.data.productid, 'urn:ot:mda:product:id:Product_1');
            assert.equal(specificVertice.data.productiondate, '2018-03-03T00:01:54Z');
            assert.equal(specificVertice.vertex_type, 'BATCH');
            assert.equal(specificVertice.sender_id, 'SENDER_ID');
            assert.equal(specificVertice.identifiers.id, 'urn:epc:id:sgtin:Batch_2');
            assert.equal(specificVertice.identifiers.uid, 'urn:epc:id:sgtin:Batch_2');
        }

        async function checkGraphExample3XmlVerticeContent() {
            specificVertice = await graphStorage.findVertexWithMaxVersion('urn:ot:mda:actor:id:Company_2', 'urn:ot:mda:actor:id:Company_2');
            assert.equal(specificVertice.data.category, 'Company');
            assert.exists(specificVertice.data.node_id);
            assert.equal(specificVertice.data.object_class_id, 'Actor');
            // assert.equal(specificVertice.data.person:id:name, "Company _2");
            assert.equal(specificVertice.vertex_type, 'ACTOR');
            assert.equal(specificVertice.sender_id, 'urn:ot:mda:actor:id:Company_2');
            assert.equal(specificVertice.identifiers.id, 'urn:ot:mda:actor:id:Company_2');
            assert.equal(specificVertice.identifiers.uid, 'urn:ot:mda:actor:id:Company_2');
        }

        async function checkGraphExample4XmlVerticeContent() {
            specificVertice = await graphStorage.findVertexWithMaxVersion('urn:ot:mda:actor:id:Hospital1', 'urn:epc:id:sgln:HospitalBuilding1.Room1047');
            assert.equal(specificVertice.data.parent_id, 'urn:epc:id:sgln:HospitalBuilding1');
            assert.equal(specificVertice.vertex_type, 'CHILD_BUSINESS_LOCATION');
            assert.equal(specificVertice.sender_id, 'urn:ot:mda:actor:id:Hospital1');
            assert.equal(specificVertice.identifiers.id, 'urn:epc:id:sgln:HospitalBuilding1.Room1047');
            assert.equal(specificVertice.identifiers.uid, 'urn:epc:id:sgln:HospitalBuilding1.Room1047');
        }

        async function checkSpecificVerticeContent(xml) {
            if (xml === 'Transformation.xml') {
                await checkTransformationXmlVerticeContent();
            } else if (xml === 'GraphExample_1.xml') {
                await checkGraphExample1XmlVerticeContent();
                await checkGraphExample1XmlTraversalPath();
            } else if (xml === 'GraphExample_2.xml') {
                await checkGraphExample2XmlVerticeContent();
            } else if (xml === 'GraphExample_3.xml') {
                await checkGraphExample3XmlVerticeContent();
            } else if (xml === 'GraphExample_4.xml') {
                await checkGraphExample4XmlVerticeContent();
            } else {
                throw Error(`Not Implemented for ${xml}.`);
            }
        }

        inputXmlFiles.forEach((test) => {
            it(`content/traversal check for ${path.basename(test.args[0])}`, async () => {
                const importResult = await gs1.parseGS1(test.args[0]);
                await checkSpecificVerticeContent(`${path.basename(test.args[0])}`);
            });
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
