/* eslint-disable max-len */
require('dotenv').config();
const {
    describe, before, beforeEach, afterEach, it,
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
const RemoteControl = require('../../modules/RemoteControl');
const Network = require('../../modules/Network');
const NetworkUtilities = require('../../modules/NetworkUtilities');
const EventEmitter = require('../../modules/EventEmitter');
const Product = require('../../modules/Product');
const Storage = require('../../modules/Storage');
const models = require('../../models');
const Web3 = require('web3');
const fs = require('fs');
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
    let importer;

    const inputXmlFiles = [
        { args: [path.join(__dirname, 'test_xml/Transformation.xml')] },
        { args: [path.join(__dirname, 'test_xml/GraphExample_1.xml')] },
        { args: [path.join(__dirname, 'test_xml/GraphExample_2.xml')] },
        { args: [path.join(__dirname, 'test_xml/GraphExample_3.xml')] },
        { args: [path.join(__dirname, 'test_xml/GraphExample_4.xml')] },
        { args: [path.join(__dirname, 'test_xml/ZKExample.xml')] },
    ];

    before('Setup models', async () => {
        Storage.models = (await models.sequelize.sync()).models;
    });

    beforeEach('Setup DB', async function setupDb() {
        this.timeout(5000);

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

        const web3 = new Web3(new Web3.providers.HttpProvider('https://rinkeby.infura.io/1WRiEqAQ9l4SW6fGdiDt'));

        const logger = Utilities.getLogger();
        graphStorage = new GraphStorage(buildSelectedDatabaseParam(databaseName), logger);
        container.register({
            logger: awilix.asValue(Utilities.getLogger()),
            gs1Importer: awilix.asClass(GS1Importer),
            gs1Utilities: awilix.asClass(GS1Utilities),
            graphStorage: awilix.asValue(graphStorage),
            importer: awilix.asClass(Importer),
            wotImporter: awilix.asClass(WOTImporter),
            remoteControl: awilix.asValue({
                importRequestData: () => {
                },
            }),
            network: awilix.asClass(Network),
            networkUtilities: awilix.asClass(NetworkUtilities),
            emitter: awilix.asClass(EventEmitter),
            product: awilix.asClass(Product),
            web3: awilix.asValue(web3),
            config: awilix.asValue(Utilities.loadConfig()),
            notifyError: awilix.asFunction(() => {}),
        });
        await graphStorage.connect();
        gs1 = container.resolve('gs1Importer');
        importer = container.resolve('importer');
    });

    describe('Parse and import XML file for n times', () => {
        const repetition = 5;
        inputXmlFiles.forEach((test) => {
            for (const i in Array.from({ length: repetition })) {
                it(
                    `should correctly parse and import ${path.basename(test.args[0])} file ${i}th time`,
                    // eslint-disable-next-line no-loop-func
                    async () => gs1.parseGS1(await Utilities.fileContents(test.args[0])),
                );
            }
        });
    });

    describe('Parse and import XML file and test pack/unpak keys', () => {
        inputXmlFiles.forEach(async (test) => {
            it(
                `should correctly pack keys for ${path.basename(test.args[0])}`,
                // eslint-disable-next-line no-loop-func
                async () => {
                    const result = await gs1.parseGS1(await Utilities.fileContents(test.args[0]));
                    const { response } = await importer.importJSON(result, true);

                    const { vertices, edges } = response;
                    for (const doc of edges.concat(vertices)) {
                        assert.isFalse(doc._dc_key != null);
                    }
                },
            );
        });
    });

    describe('_keys should not be changing on re-imports', async () => {
        async function getAllVerticesKeys() {
            const verticesKeys = [];
            let myKey;

            const sender_id = 'urn:ot:object:actor:id:Company_2';
            const Company_2_timestamp = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:ot:object:actor:id:Company_2:2015-04-17T00:00:00.000-04:00Z-04:00');
            const Building_1 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:epc:id:sgln:Building_1');
            const Batch_1 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:epc:id:sgtin:Batch_1');
            const Product_1 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:ot:object:product:id:Product_1');
            const Company_1 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:ot:object:actor:id:Company_1');
            const Company_2 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:ot:object:actor:id:Company_2');
            const Building_2 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:epc:id:sgln:Building_2');

            const nodes = [Company_2, Company_2_timestamp, Building_1, Batch_1,
                Product_1, Company_1, Building_2];

            nodes.forEach((node) => {
                myKey = node._key;
                verticesKeys.push(myKey);
            });

            verticesKeys.push('Ownership');
            verticesKeys.push('Location');
            verticesKeys.push('Product');
            verticesKeys.push('Actor');
            verticesKeys.push('Observation');
            verticesKeys.push('Transport');
            verticesKeys.push('Transformation');

            return verticesKeys;
        }

        it('check keys immutability on GraphExample_3.xml', async () => {
            const myGraphExample3 = path.join(__dirname, 'test_xml/GraphExample_3.xml');

            await gs1.parseGS1(await Utilities.fileContents(myGraphExample3));
            const firstImportVerticesCount = await graphStorage.getDocumentsCount('ot_vertices');
            assert.equal(firstImportVerticesCount, 14, 'There should be 14 vertices');

            const firstImportVerticesKeys = await getAllVerticesKeys();
            assert.equal(firstImportVerticesKeys.length, firstImportVerticesCount);

            // re-import into same db instance
            await gs1.parseGS1(await Utilities.fileContents(myGraphExample3));
            const secondImportVerticesCount = await graphStorage.getDocumentsCount('ot_vertices');
            assert.equal(secondImportVerticesCount, 14, 'There should be 14 vertices');

            const secondImportVerticesKeys = await getAllVerticesKeys();
            assert.equal(secondImportVerticesKeys.length, 14, 'There should be 14 vertices as well');
            assert.equal(secondImportVerticesKeys.length, secondImportVerticesCount);

            // make sure _keys stay identical
            assert.deepEqual(firstImportVerticesKeys, secondImportVerticesKeys, 'Keys should stay same after reimport');
        });
    });

    describe('Total # of docs/edges after re-import of same file should remain constant', async () => {
        it('check total graph nodes count in scenario of GraphExample_3.xml', async () => {
            const myGraphExample3 = path.join(__dirname, 'test_xml/GraphExample_3.xml');

            await gs1.parseGS1(await Utilities.fileContents(myGraphExample3));
            const verticesCount1 = await graphStorage.getDocumentsCount('ot_vertices');
            assert.isNumber(verticesCount1);
            assert.isTrue(verticesCount1 >= 0, 'we expect positive number of vertices');
            const edgesCount1 = await graphStorage.getDocumentsCount('ot_edges');
            assert.isNumber(edgesCount1);
            assert.isTrue(edgesCount1 >= 0, 'we expect positive number of edges');

            await gs1.parseGS1(await Utilities.fileContents(myGraphExample3));
            const verticesCount2 = await graphStorage.getDocumentsCount('ot_vertices');
            assert.isTrue(verticesCount2 >= 0, 'we expect positive number of vertices');
            assert.isNumber(verticesCount2);
            const edgesCount2 = await graphStorage.getDocumentsCount('ot_edges');
            assert.isNumber(edgesCount1);
            assert.isTrue(edgesCount2 >= 0, 'we expect positive number of edges');


            assert.equal(verticesCount1, verticesCount2, '# of docs should remain constant after re-import');
            assert.equal(edgesCount1, edgesCount2, '# of edges should remain constant after re-import');
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
                    if (vertex.data.quantities) {
                        delete vertex.data.quantities.e;
                        delete vertex.data.quantities.a;
                        delete vertex.data.quantities.importId;
                        delete vertex.data.quantities.zp;
                        delete vertex2.data.quantities.e;
                        delete vertex2.data.quantities.a;
                        delete vertex2.data.quantities.importId;
                        delete vertex2.data.quantities.zp;
                        if (vertex.data.quantities.inputs) {
                            vertex.data.quantities.inputs.forEach((input) => {
                                if (input.public) {
                                    delete input.private.r;
                                    delete input.public.enc;
                                }
                            });
                            vertex2.data.quantities.inputs.forEach((input) => {
                                if (input.public) {
                                    delete input.private.r;
                                    delete input.public.enc;
                                }
                            });
                        }
                        if (vertex.data.quantities.outputs) {
                            vertex.data.quantities.outputs.forEach((output) => {
                                if (output.public) {
                                    delete output.private.r;
                                    delete output.public.enc;
                                }
                            });
                            vertex2.data.quantities.outputs.forEach((output) => {
                                if (output.public) {
                                    delete output.private.r;
                                    delete output.public.enc;
                                }
                            });
                        }
                        if (vertex.data.quantities.private) {
                            delete vertex.data.quantities.private.r;
                            delete vertex2.data.quantities.private.r;
                        }
                        if (vertex.data.quantities.public) {
                            delete vertex.data.quantities.public.enc;
                            delete vertex2.data.quantities.public.enc;
                        }
                    }
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
                    const import1Result = await gs1.parseGS1(await Utilities.fileContents(test.args[0]));
                    const import2Result = await gs1.parseGS1(await Utilities.fileContents(test.args[0]));
                    checkImportResults(import1Result, import2Result);

                    const processedResult1 = await importer.afterImport(import1Result);
                    const processedResult2 = await importer.afterImport(import2Result);
                    checkProcessedResults(processedResult1, processedResult2);
                },
            );
        });

        it('should correctly import all examples together', async function () {
            this.timeout(30000);

            const importResults = [];
            const imports = [];

            imports.push(...inputXmlFiles);
            imports.push(...inputXmlFiles);

            for (let i = 0; i < imports.length; i += 1) {
                // eslint-disable-next-line no-await-in-loop
                const result = await gs1.parseGS1(await Utilities.fileContents(imports[i].args[0]));
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
            specificVertice = await graphStorage.findVertexWithMaxVersion('urn:ot:object:actor:id:Car.Engines', 'urn:ot:object:product:id:123AB');
            assert.equal(specificVertice.data.category, 'Engine');
            assert.equal(specificVertice.data.description, 'Airplane Engine for Boing');
            assert.equal(specificVertice.data.object_class_id, 'Product');
            assert.equal(specificVertice.vertex_type, 'PRODUCT');
            assert.equal(specificVertice.sender_id, 'urn:ot:object:actor:id:Car.Engines');
            assert.equal(specificVertice.identifiers.id, 'urn:ot:object:product:id:123AB');
            assert.equal(specificVertice.identifiers.uid, 'urn:ot:object:product:id:123AB');
        }

        async function checkGraphExample1XmlVerticeContent() {
            specificVertice = await graphStorage.findVertexWithMaxVersion('urn:ot:object:actor:id:Company_1', 'urn:epc:id:sgln:Building_2');
            assert.equal(specificVertice.data.category, 'Building _2');
            assert.equal(specificVertice.data.description, 'Description of building _2');
            assert.equal(specificVertice.data.object_class_id, 'Location');
            assert.equal(specificVertice.vertex_type, 'LOCATION');
            assert.equal(specificVertice.sender_id, 'urn:ot:object:actor:id:Company_1');
            assert.equal(specificVertice.identifiers.id, 'urn:epc:id:sgln:Building_2');
            assert.equal(specificVertice.identifiers.uid, 'urn:epc:id:sgln:Building_2');
        }

        async function checkGraphExample1XmlTraversalPath() {
            // getting keys of all 12 nodes that should be in Batch_1 traversal data
            let myKey;
            const sender_id = 'urn:ot:object:actor:id:Company_1';
            const expectedKeys = [];
            const Batch_1 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:epc:id:sgtin:Batch_1');
            const Location_Building_1 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:epc:id:sgln:Building_1');
            const Location_Building_2 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:epc:id:sgln:Building_2');
            const Actor_Company_1 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:ot:object:actor:id:Company_1');
            const Actor_Company_2 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:ot:object:actor:id:Company_2');
            const Event_Company_1 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:ot:object:actor:id:Company_1:2015-04-17T00:00:00.000-04:00Z-04:00');
            const Product_1 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:ot:object:product:id:Product_1');
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
            specificVertice = await graphStorage.findVertexWithMaxVersion('urn:ot:object:actor:id:Company _1', 'urn:epc:id:sgtin:Batch_2');
            assert.equal(specificVertice.data.expirationdate, '2018-04-03T00:01:54Z');
            assert.equal(specificVertice.data.parent_id, 'urn:ot:object:product:id:Product_1');
            assert.equal(specificVertice.data.productId, 'urn:ot:object:product:id:Product_1');
            assert.equal(specificVertice.data.productiondate, '2018-03-03T00:01:54Z');
            assert.equal(specificVertice.vertex_type, 'BATCH');
            assert.equal(specificVertice.sender_id, 'urn:ot:object:actor:id:Company _1');
            assert.equal(specificVertice.identifiers.id, 'urn:epc:id:sgtin:Batch_2');
            assert.equal(specificVertice.identifiers.uid, 'urn:epc:id:sgtin:Batch_2');
        }

        async function checkGraphExample3XmlVerticeContent() {
            specificVertice = await graphStorage.findVertexWithMaxVersion('urn:ot:object:actor:id:Company_2', 'urn:ot:object:actor:id:Company_2');
            assert.equal(specificVertice.data.category, 'Company');
            assert.exists(specificVertice.data.node_id);
            assert.equal(specificVertice.data.object_class_id, 'Actor');
            // assert.equal(specificVertice.data.name, "Company _2");
            assert.equal(specificVertice.vertex_type, 'ACTOR');
            assert.equal(specificVertice.sender_id, 'urn:ot:object:actor:id:Company_2');
            assert.equal(specificVertice.identifiers.id, 'urn:ot:object:actor:id:Company_2');
            assert.equal(specificVertice.identifiers.uid, 'urn:ot:object:actor:id:Company_2');
        }

        async function checkGraphExample4XmlVerticeContent() {
            specificVertice = await graphStorage.findVertexWithMaxVersion('urn:ot:object:actor:id:Hospital1', 'urn:epc:id:sgln:HospitalBuilding1.Room1047');
            assert.equal(specificVertice.data.parent_id, 'urn:epc:id:sgln:HospitalBuilding1');
            assert.equal(specificVertice.vertex_type, 'CHILD_LOCATION');
            assert.equal(specificVertice.sender_id, 'urn:ot:object:actor:id:Hospital1');
            assert.equal(specificVertice.identifiers.id, 'urn:epc:id:sgln:HospitalBuilding1.Room1047');
            assert.equal(specificVertice.identifiers.uid, 'urn:epc:id:sgln:HospitalBuilding1.Room1047');
        }

        async function checkGraphExample4XmlTraversalPath() {
            let myKey;
            const expectedKeys = [];

            const sender_id = 'urn:ot:object:actor:id:Hospital1';
            const Room1048 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:epc:id:sgln:HospitalBuilding1.Room1048');
            const HospitalBuilding1 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:epc:id:sgln:HospitalBuilding1');
            const Hospital1 = await graphStorage.findVertexWithMaxVersion(sender_id, 'urn:ot:object:actor:id:Hospital1');

            const nodes = [Room1048, HospitalBuilding1, Hospital1];

            nodes.forEach((node) => {
                myKey = node._key;
                expectedKeys.push(myKey);
            });

            expectedKeys.push('Actor');
            expectedKeys.push('Location');

            const path = await graphStorage.findTraversalPath(Room1048, 200);

            // there should be 5 node in traversal for this start vertex
            assert.equal(Object.keys(path.data).length, 5);

            const keysFromTraversal = Object.keys(path.data);
            // make sure that all _keys match
            assert.sameMembers(keysFromTraversal, expectedKeys);
        }

        async function checkSpecificVerticeContent(xml) {
            if (xml === path.join(__dirname, 'test_xml/Transformation.xml')) {
                await checkTransformationXmlVerticeContent();
            } else if (xml === path.join(__dirname, 'test_xml/GraphExample_1.xml')) {
                await checkGraphExample1XmlVerticeContent();
                await checkGraphExample1XmlTraversalPath();
            } else if (xml === path.join(__dirname, 'test_xml/GraphExample_2.xml')) {
                await checkGraphExample2XmlVerticeContent();
            } else if (xml === path.join(__dirname, 'test_xml/GraphExample_3.xml')) {
                await checkGraphExample3XmlVerticeContent();
            } else if (xml === path.join(__dirname, 'test_xml/GraphExample_4.xml')) {
                await checkGraphExample4XmlVerticeContent();
                await checkGraphExample4XmlTraversalPath();
            } else if (xml === path.join(__dirname, 'test_xml/ZKExample.xml')) {
                // TODO checkZKExampleXmlVerticeContent();
            } else {
                throw Error(`Not Implemented for ${xml}.`);
            }
        }

        inputXmlFiles.forEach((test) => {
            it(`content/traversal check for ${path.basename(test.args[0])}`, async () => {
                await gs1.parseGS1(await Utilities.fileContents(test.args[0]));
                await checkSpecificVerticeContent(`${test.args[0]}`);
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
