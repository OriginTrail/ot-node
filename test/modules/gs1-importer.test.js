/* eslint-disable max-len */
require('dotenv').config();
const {
    describe, before, beforeEach, afterEach, it,
} = require('mocha');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const { assert, expect } = chai;
const path = require('path');
const { Database } = require('arangojs');
const rc = require('rc');
const GraphStorage = require('../../modules/Database/GraphStorage');
const GS1Utilities = require('../../modules/importer/gs1-utilities');
const Utilities = require('../../modules/Utilities');
const ImportUtilities = require('../../modules/ImportUtilities');
const Network = require('../../modules/network/kademlia/kademlia');
const NetworkUtilities = require('../../modules/network/kademlia/kademlia-utils');
const EventEmitter = require('../../modules/EventEmitter');
const Product = require('../../modules/Product');
const Storage = require('../../modules/Storage');
const models = require('../../models');
const Web3 = require('web3');
const awilix = require('awilix');
const logger = require('../../modules/logger');
const ImportService = require('../../modules/service/import-service');
const OtJsonUtilities = require('../../modules/OtJsonUtilities');

const PermissionedDataService = require('../../modules/service/permissioned-data-service');
const EpcisOtJsonTranspiler = require('../../modules/transpiler/epcis/epcis-otjson-transpiler');
const SchemaValidator = require('../../modules/validator/schema-validator');

const defaultConfig = require('../../config/config.json').development;
const pjson = require('../../package.json');

describe('GS1 Importer tests', () => {
    const databaseName = 'gs1-test';
    let graphStorage;
    let systemDb;
    let importService;
    let importer;
    let epcisOtJsonTranspiler;
    let blockchain;

    const inputXmlFiles = [
        { args: [path.join(__dirname, 'test_xml/Transformation.xml')] },
        { args: [path.join(__dirname, 'test_xml/GraphExample_1.xml')] },
        { args: [path.join(__dirname, 'test_xml/GraphExample_2.xml')] },
        { args: [path.join(__dirname, 'test_xml/GraphExample_3.xml')] },
        { args: [path.join(__dirname, 'test_xml/GraphExample_4.xml')] },
        { args: [path.join(__dirname, 'test_xml/ZKExample.xml')] },
        { args: [path.join(__dirname, '../../importers/xml_examples/Retail_with_Zk/01_Green_to_pink_shipment.xml')] },
        { args: [path.join(__dirname, '../../importers/xml_examples/Retail_with_Zk/02_Green_to_Pink_receipt.xml')] },
        { args: [path.join(__dirname, '../../importers/xml_examples/Retail_with_Zk/03_Pink_ZKN_Transform.xml')] },
        { args: [path.join(__dirname, '../../importers/xml_examples/Retail_with_Zk/04_Pink_to_Orange_shipment.xml')] },
        { args: [path.join(__dirname, '../../importers/xml_examples/Retail_with_Zk/05_Pink_to_Orange_receipt.xml')] },
        { args: [path.join(__dirname, '../../importers/xml_examples/Retail_with_Zk/06_Pink_to_Red_shipment.xml')] },
        { args: [path.join(__dirname, '../../importers/xml_examples/Retail_with_Zk/07_Pink_to_Red_receipt.xml')] },
    ];

    function convertToImportDoc(content) {
        return {
            document: epcisOtJsonTranspiler.convertToOTJson(content, blockchain),
            encryptedMap: null,
            blockchain_id: blockchain[0].blockchain_id,
        };
    }

    before('Setup models', async () => {
        Storage.models = (await models.sequelize.sync()).models;
    });

    beforeEach('Setup DB', async function setupDb() {
        this.timeout(5000);

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

        blockchain = [{
            blockchain_id: 'ethr',
            hub_contract_address: '0x2B7ca432a13e0D035BC46F0d6bf3cde1E72A10E5',
            identity: '0x2Fa6d32E314AAB43a58999D6f5532A15418Da153',
            erc725Identity: '0x611d771aAfaa3D6Fb66c4a81D97768300a6882D5',
            node_wallet: '0xa9a07f3c53ec5de8dd83039ca27fae83408e16f5',
            node_private_key: '952e45854ca5470a6d0b6cb86346c0e9c4f8f3a5a459657df8c94265183b9253',
        }];

        // Create the container and set the injectionMode to PROXY (which is also the default).
        const container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });

        const web3 = new Web3(new Web3.providers.HttpProvider('https://rinkeby.infura.io/1WRiEqAQ9l4SW6fGdiDt'));

        graphStorage = new GraphStorage(config.database, logger);
        container.register({
            logger: awilix.asValue(logger),
            gs1Utilities: awilix.asClass(GS1Utilities),
            graphStorage: awilix.asValue(graphStorage),
            schemaValidator: awilix.asClass(SchemaValidator).singleton(),
            importService: awilix.asClass(ImportService).singleton(),
            epcisOtJsonTranspiler: awilix.asClass(EpcisOtJsonTranspiler).singleton(),
            remoteControl: awilix.asValue({
                importRequestData: () => {
                },
            }),
            network: awilix.asClass(Network),
            networkUtilities: awilix.asClass(NetworkUtilities),
            emitter: awilix.asClass(EventEmitter),
            product: awilix.asClass(Product),
            config: awilix.asValue(config),
            permissionedDataService: awilix.asClass(PermissionedDataService).singleton(),
        });
        await graphStorage.connect();
        importService = container.resolve('importService');
        epcisOtJsonTranspiler = container.resolve('epcisOtJsonTranspiler');
    });

    describe('Parse and import XML file for n times', () => {
        const repetition = 5;
        inputXmlFiles.forEach((test) => {
            for (const i in Array.from({ length: repetition })) {
                it(
                    `should correctly parse and import ${path.basename(test.args[0])} file ${i}th time`,
                    // eslint-disable-next-line no-loop-func
                    async () => importService.importFile(convertToImportDoc(await Utilities.fileContents(test.args[0]))),
                );
            }
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

        it.skip('check keys immutability on GraphExample_3.xml', async () => {
            const myGraphExample3 = path.join(__dirname, 'test_xml/GraphExample_3.xml');

            await importService.importFile(convertToImportDoc(await Utilities.fileContents(myGraphExample3)));
            const firstImportVerticesCount = await graphStorage.getDocumentsCount('ot_vertices');
            assert.equal(firstImportVerticesCount, 14, 'There should be 14 vertices');

            const firstImportVerticesKeys = await getAllVerticesKeys();
            assert.equal(firstImportVerticesKeys.length, firstImportVerticesCount);

            // re-import into same db instance
            await importService.importFile(convertToImportDoc(await Utilities.fileContents(myGraphExample3)));
            const secondImportVerticesCount = await graphStorage.getDocumentsCount('ot_vertices');
            assert.equal(secondImportVerticesCount, 14, 'There should be 14 vertices');

            const secondImportVerticesKeys = await getAllVerticesKeys();
            assert.equal(secondImportVerticesKeys.length, 14, 'There should be 14 vertices as well');
            assert.equal(secondImportVerticesKeys.length, secondImportVerticesCount);

            // make sure _keys stay identical
            assert.deepEqual(firstImportVerticesKeys, secondImportVerticesKeys, 'Keys should stay same after reimport');
        });
    });

    describe.skip('Total # of docs/edges after re-import of same file should remain constant', async () => {
        it('check total graph nodes count in scenario of GraphExample_3.xml', async () => {
            const myGraphExample3 = path.join(__dirname, 'test_xml/GraphExample_3.xml');

            await importService.importFile(convertToImportDoc(await Utilities.fileContents(myGraphExample3)));
            const verticesCount1 = await graphStorage.getDocumentsCount('ot_vertices');
            assert.isNumber(verticesCount1);
            assert.isTrue(verticesCount1 >= 0, 'we expect positive number of vertices');
            const edgesCount1 = await graphStorage.getDocumentsCount('ot_edges');
            assert.isNumber(edgesCount1);
            assert.isTrue(edgesCount1 >= 0, 'we expect positive number of edges');

            await importService.importFile(convertToImportDoc(await Utilities.fileContents(myGraphExample3)));
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

    describe('OT-JSON file after transpilation should have a connector in graph structure', async () => {
        it('check if a connector exists in scenario of Green_to_pink_shipment.xml', async () => {
            const shipment = path.join(__dirname, '../../importers/xml_examples/Retail/01_Green_to_pink_shipment.xml');

            const otJson = epcisOtJsonTranspiler.convertToOTJson(await Utilities.fileContents(shipment), blockchain);
            assert.equal(otJson['@graph'].filter(x => x['@type'] === 'otConnector').length, 1, 'connector should exist in otJson');
        });
    });

    describe('OT-JSON files before and after import should be the same', async () => {
        inputXmlFiles.forEach((inputFile) => {
            it(
                `should correctly import ${path.basename(inputFile.args[0])} and retrieve it from database`,
                // eslint-disable-next-line no-loop-func
                async () => {
                    const xmlContents = await Utilities.fileContents(inputFile.args[0]);
                    const otJson = epcisOtJsonTranspiler.convertToOTJson(xmlContents, blockchain);

                    const {
                        data_set_id,
                    } = await importService.importFile({
                        document: otJson,
                        blockchain_id: blockchain[0].blockchain_id,
                    });

                    const otJsonFromDb = await importService.getImport(data_set_id);
                    assert.isNotNull(otJsonFromDb, 'DB result is null');

                    const sortedFirst = ImportUtilities.sortStringifyDataset(otJson);
                    const sortedSecond = ImportUtilities.sortStringifyDataset(otJsonFromDb);
                    assert.deepEqual(sortedFirst, sortedSecond, `Converted XML for ${path.basename(inputFile.args[0])} is not equal to the original one`);
                },
            );
        });
    });

    describe.skip('Graph validation', async () => {
        function checkImportResults(import1Result, import2Result) {
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
            expect(processedResult1.import_hash).to.be.equal(processedResult2.import_hash);
            expect(processedResult1.total_documents).to.be.equal(processedResult1.total_documents);
        }

        inputXmlFiles.forEach((test) => {
            it(
                `should generate the same graph for subsequent ${path.basename(test.args[0])} imports`,
                async () => {
                    const import1Result = await importService.importFile(convertToImportDoc(await Utilities.fileContents(test.args[0])));
                    const import2Result = await importService.importFile(convertToImportDoc(await Utilities.fileContents(test.args[0])));
                    checkImportResults(import1Result, import2Result);

                    const processedResult1 = await importer.afterImport(import1Result);
                    const processedResult2 = await importer.afterImport(import2Result);
                    checkProcessedResults(processedResult1, processedResult2);
                },
            );
        });

        it.skip('should correctly import all examples together', async function () {
            this.timeout(30000);

            const importResults = [];
            const imports = [];

            imports.push(...inputXmlFiles);
            imports.push(...inputXmlFiles);

            for (let i = 0; i < imports.length; i += 1) {
                // eslint-disable-next-line no-await-in-loop
                const result = await importService.importFile(convertToImportDoc(await Utilities.fileContents(imports[i].args[0])));
                importResults.push(result);
            }

            for (let i = 0; i < inputXmlFiles.length; i += 1) {
                checkImportResults(importResults[i], importResults[i + inputXmlFiles.length]);
            }
        });
    });

    describe.skip('Random vertices content and traversal path check', async () => {
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
            } else if (xml === path.join(__dirname, '../../importers/xml_examples/Retail_with_Zk/01_Green_to_pink_shipment.xml')) {
                // TODO implement me
            } else if (xml === path.join(__dirname, '../../importers/xml_examples/Retail_with_Zk/02_Green_to_Pink_receipt.xml')) {
                // TODO implement me
            } else if (xml === path.join(__dirname, '../../importers/xml_examples/Retail_with_Zk/03_Pink_ZKN_Transform.xml')) {
                // TODO implement me
            } else if (xml === path.join(__dirname, '../../importers/xml_examples/Retail_with_Zk/04_Pink_to_Orange_shipment.xml')) {
                // TODO implement me
            } else if (xml === path.join(__dirname, '../../importers/xml_examples/Retail_with_Zk/05_Pink_to_Orange_receipt.xml')) {
                // TODO implement me
            } else if (xml === path.join(__dirname, '../../importers/xml_examples/Retail_with_Zk/06_Pink_to_Red_shipment.xml')) {
                // TODO implement me
            } else if (xml === path.join(__dirname, '../../importers/xml_examples/Retail_with_Zk/07_Pink_to_Red_receipt.xml')) {
                // TODO implement me
            } else {
                throw Error(`Not Implemented for ${xml}.`);
            }
        }

        inputXmlFiles.forEach((test) => {
            it(`content/traversal check for ${path.basename(test.args[0])}`, async () => {
                await importService.importFile(convertToImportDoc(await Utilities.fileContents(test.args[0])));
                await checkSpecificVerticeContent(`${test.args[0]}`);
            });
        });
    });

    describe.skip('Incomplete xmls should fail to import', () => {
        const xmlWithoutQuantityList = path.join(__dirname, 'test_xml/withoutQuantityList.xml');
        const xmlWithoutBizStep = path.join(__dirname, 'test_xml/withoutBizStep.xml');
        const xmlWithoutCreationDateAndTime = path.join(__dirname, 'test_xml/withoutCreationDateAndTime.xml');
        const xmlWithoutSenderContactinfo = path.join(__dirname, 'test_xml/withoutSenderContactInfo.xml');

        it('exceptionally, case xmlWithoutQuantityList should import with success', async () => expect(importService.importFile(convertToImportDoc(await Utilities.fileContents(xmlWithoutQuantityList)))).to.be.fulfilled);

        it('and throw an error related to missing bizStep', async () => expect(importService.importFile(convertToImportDoc(await Utilities.fileContents(xmlWithoutBizStep)))).to.be.rejectedWith(TypeError, "Cannot read property 'replace' of undefined"));

        it('and throw an error related to missing CreationDateAndTime', async () => {
            const rejectionMessage = 'Failed to validate schema. Error: Element \'{http://www.unece.org/cefact/namespaces/StandardBusinessDocumentHeader}DocumentIdentification\': Missing child element(s). Expected is one of ( {http://www.unece.org/cefact/namespaces/StandardBusinessDocumentHeader}MultipleType, {http://www.unece.org/cefact/namespaces/StandardBusinessDocumentHeader}CreationDateAndTime ).\n';
            return expect(importService.importFile(convertToImportDoc(await Utilities.fileContents(xmlWithoutCreationDateAndTime)))).to.be.rejectedWith(Error, rejectionMessage);
        });

        it('and throw an error releted to missing SenderContactInformation', async () => expect(importService.importFile(convertToImportDoc(await Utilities.fileContents(xmlWithoutSenderContactinfo)))).to.be.rejectedWith(Error, "Cannot read property 'EmailAddress' of undefined"));
    });

    describe.skip('Double event identifiers should fail', () => {
        const xmlDoubleIds = path.join(__dirname, 'test_xml/DoubleEventId.xml');

        it('Should fail to import double event identifiers', async () => expect(importService.importFile(convertToImportDoc(await Utilities.fileContents(xmlDoubleIds)))).to.rejectedWith(Error, 'Double event identifiers'));
    });

    describe('Multiple same identifiers for different vertices should import correctly', () => {
        const xmlDoubleIds = path.join(__dirname, 'test_xml/MultipleIdentifiers.xml');

        it('Should import without error', async () => expect(importService.importFile(convertToImportDoc(await Utilities.fileContents(xmlDoubleIds)))).to.be.fulfilled);
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
