const Utilities = require('../../modules/Utilities');

const {
    describe, before, beforeEach, after, afterEach, it,
} = require('mocha');
const { assert, expect } = require('chai');
const ArangoJs = require('../../modules/Database/Arangojs');
const databaseData = require('./test_data/database-data.js');
// eslint-disable-next-line prefer-destructuring
const Database = require('arangojs').Database;

const myUserName = 'otuser';
const myPassword = 'otpass';
const myDatabaseName = 'testDb';

const documentCollectionName = 'ot_vertices';
const edgeCollectionName = 'ot_edges';
const vertexOne = databaseData.vertices[0];
const vertexTwo = databaseData.vertices[1];
const edgeOne = databaseData.edges[0];
const newImportValue = 2520345631;
const oneMoreImportValue = 2520345639;

let systemDb;
let testDb;

describe('Arangojs module ', async () => {
    before('create and use testDb db', async () => {
        systemDb = new Database();
        systemDb.useBasicAuth('root', 'root');

        // Drop test database if exist.
        const listOfDatabases = await systemDb.listDatabases();
        if (listOfDatabases.includes(myDatabaseName)) {
            await systemDb.dropDatabase(myDatabaseName);
        }

        await systemDb.createDatabase(
            myDatabaseName,
            [{ username: myUserName, passwd: myPassword, active: true }],
        );
        testDb = new ArangoJs(myUserName, myPassword, myDatabaseName, '127.0.0.1', '8529');
    });

    afterEach('drop ot_vertices and ot_edges collections', async () => {
        try {
            const myDocumentCollection = testDb.db.collection(documentCollectionName);
            await myDocumentCollection.drop();
        } catch (error) {
            // this means there was no collection to drop, all good, move on
        }

        try {
            const myEdgeCollection = testDb.db.collection(edgeCollectionName);
            await myEdgeCollection.drop();
        } catch (error) {
            // this means there was no collection to drop, all good, move on
        }
    });

    it('.identify() should return correct name', () => {
        assert(testDb.identify(), 'ArangoJS');
    });

    it('should see at least one system and one custom database', async () => {
        expect(testDb.db.name).to.be.equal('testDb');
        expect(systemDb).to.be.an.instanceof(Database);
        const listOfDatabases = await testDb.db.listDatabases();
        assert.isTrue(listOfDatabases.includes('_system'));
        assert.isTrue(listOfDatabases.includes('testDb'));
    });

    it('.runQuery() should give back result', async () => {
        const now = Date.now();
        await testDb.runQuery('RETURN @value', { value: now }).then((response) => {
            assert.approximately(response[0], now, 1000, 'Resulted time is approx same as current');
        });
    });

    it('.runQuery() on invalid instance should not give back result', async () => {
        const now = Date.now();
        try {
            await testDb.runQuery('RETURN @value', { value: now });
        } catch (error) {
            assert.isTrue(error.toString().indexOf('Not connected to graph database') >= 0);
        }
    });

    it('.createCollection() should create Document Collection', async () => {
        // first time creating Document Collection
        await testDb.createCollection(documentCollectionName).then((response) => {
            assert.equal(response, 'Collection created');
        });

        // this will cover 409 path
        await testDb.createCollection(documentCollectionName).then((response) => {
            assert.equal(response, 'Double insert');
        });

        const myCollection = testDb.db.collection(documentCollectionName);
        const data = await myCollection.get();
        assert.equal(data.code, 200);
        assert.isFalse(data.isSystem);
        assert.equal(data.name, documentCollectionName);
        const info = await testDb.db.listCollections();
        assert.equal(info.length, 1);
    });

    it('.createEdgeCollection() should create Edge Collection', async () => {
        // first time creating Edge Collection
        await testDb.createEdgeCollection(edgeCollectionName).then((response) => {
            assert.equal(response, 'Edge collection created');
        });

        // this will cover 409 path
        await testDb.createEdgeCollection(edgeCollectionName).then((response) => {
            assert.equal(response, 'Double insert');
        });

        const myCollection = testDb.db.collection(edgeCollectionName);
        const data = await myCollection.get();
        assert.equal(data.code, 200);
        assert.isFalse(data.isSystem);
        assert.equal(data.name, edgeCollectionName);
        const info = await testDb.db.listCollections();
        assert.equal(info.length, 1);
    });

    it('.createEdgeCollection() with system collection name should be illegal', async () => {
        try {
            await testDb.createCollection('_statistics');
        } catch (e) {
            assert.isTrue(e.toString().indexOf('ArangoError: illegal name') >= 0);
        }
    });

    it('.createEdgeCollection() with null as collection name', async () => {
        try {
            await testDb.createEdgeCollection(null);
        } catch (error) {
            assert.isTrue(error.toString().indexOf('ArangoError: illegal name') >= 0);
        }
    });

    it('.addVertex() should save vertex in Document Collection ot_vertices', async () => {
        // precondition
        await testDb.createCollection(documentCollectionName);

        const response = await testDb.addVertex(vertexOne);
        assert.containsAllKeys(response, ['_id', '_key', '_rev']);

        // now lets check that we\'ve really saved vertex data
        const myCollection = testDb.db.collection(documentCollectionName);
        // eslint-disable-next-line no-underscore-dangle
        const retrievedVertex = await myCollection.document(vertexOne._key);
        assert.deepEqual(retrievedVertex.data, vertexOne.data);
        assert.deepEqual(retrievedVertex.vertex_type, vertexOne.vertex_type);
        assert.deepEqual(retrievedVertex.identifiers, vertexOne.identifiers);
        assert.deepEqual(retrievedVertex.data_provider, vertexOne.data_provider);
        assert.deepEqual(retrievedVertex.imports, vertexOne.imports);
        // eslint-disable-next-line no-underscore-dangle
        assert.equal(retrievedVertex.vertex_key, vertexOne.vertex_key);
        // eslint-disable-next-line no-underscore-dangle
        assert.equal(retrievedVertex._key, vertexOne._key);
    });

    it('trying to add same vertex again should give result with the same vertex', async () => {
        // precondition
        await testDb.createCollection(documentCollectionName);
        await testDb.addVertex(vertexOne);

        const response = await testDb.addVertex(vertexOne);
        assert.equal(response._key, vertexOne._key);
    });

    it('trying to add null document', async () => {
        // precondition
        await testDb.createCollection(documentCollectionName);

        try {
            await testDb.addVertex(null);
        } catch (error) {
            assert.isTrue(error.toString().indexOf('ArangoError: invalid document type') >= 0);
        }
    });

    it('.addEdge() should save edge in Edge Document Collection', async () => {
        // precondition
        await testDb.createEdgeCollection(edgeCollectionName);

        const response = await testDb.addEdge(edgeOne);
        assert.containsAllKeys(response, ['_id', '_key', '_rev']);

        // now lets check that we\'ve saved edge correctly
        const myCollection = testDb.db.edgeCollection(edgeCollectionName);
        // eslint-disable-next-line no-underscore-dangle
        const retrievedEdge = await myCollection.edge(edgeOne._key);
        // eslint-disable-next-line no-underscore-dangle
        assert.deepEqual(retrievedEdge._key, edgeOne._key);
        assert.deepEqual(retrievedEdge.edge_type, edgeOne.edge_type);
        assert.deepEqual(retrievedEdge.data_provider, edgeOne.data_provider);
        assert.deepEqual(retrievedEdge.imports, edgeOne.imports);
        // eslint-disable-next-line no-underscore-dangle
        assert.deepEqual(retrievedEdge._to, edgeOne._to);
        // eslint-disable-next-line no-underscore-dangle
        assert.deepEqual(retrievedEdge._from, edgeOne._from);
    });

    it('parse virtualGraph', async () => {
        // precondition
        await testDb.createEdgeCollection(edgeCollectionName);
        await testDb.createCollection(documentCollectionName);

        const responseEdgeOne = await testDb.addEdge(edgeOne);
        assert.containsAllKeys(responseEdgeOne, ['_id', '_key', '_rev']);

        const responseVertexOne = await testDb.addVertex(vertexOne);
        assert.equal(responseVertexOne._key, vertexOne._key);

        const responseVertexTwo = await testDb.addVertex(vertexTwo);
        assert.equal(responseVertexTwo._key, vertexTwo._key);

        const path = await testDb.findTraversalPath(vertexOne, 1000);

        function sortByKey(a, b) {
            if (a._key < b._key) {
                return 1;
            }
            if (a._key > b._key) {
                return -1;
            }
            return 0;
        }

        const objectVertices = [vertexOne, vertexTwo];
        const objectEdges = [edgeOne];
        assert.deepEqual(
            testDb.getEdgesFromVirtualGraph(path).sort(sortByKey),
            Utilities.copyObject(objectEdges).sort(sortByKey),
        );
        assert.deepEqual(
            testDb.getVerticesFromVirtualGraph(path).sort(sortByKey),
            Utilities.copyObject(objectVertices).sort(sortByKey),
        );
    });

    it('importVirtualGraph', async () => {
        // TODO
        console.log('');
    });

    it('updateImports() should add/append data', async () => {
        // precondition
        await testDb.createEdgeCollection(edgeCollectionName);
        await testDb.addEdge(edgeOne);

        // this will implicitly call testDb.updateDocument()
        await testDb.updateImports(
            edgeCollectionName,
            // eslint-disable-next-line no-underscore-dangle
            edgeOne._key, newImportValue,
        ).then((response) => {
            assert.containsAllKeys(response, ['_id', '_key', '_rev']);
        });

        // check value of imports
        await testDb.getDocument(edgeCollectionName, edgeOne._key).then((response) => {
            assert.include(response.imports, newImportValue);
        });

        // this will implicitly call testDb.updateDocument()
        await testDb.updateImports(
            edgeCollectionName,
            // eslint-disable-next-line no-underscore-dangle
            edgeOne._key, newImportValue + 1,
        ).then((response) => {
            assert.containsAllKeys(response, ['_id', '_key', '_rev', '_oldRev']);
        });

        // check value of imports
        await testDb.getDocument(edgeCollectionName, edgeOne._key).then((response) => {
            assert.include(response.imports, newImportValue + 1);
        });
    });

    it('getDocument() by vertexKey should give back vertex itself', async () => {
        // precondition
        await testDb.createCollection(documentCollectionName);
        await testDb.addVertex(vertexOne);

        await testDb.getDocument(documentCollectionName, vertexOne._key)
            .then((response) => {
                assert.deepEqual(response._key, vertexOne._key);
                assert.deepEqual(response.data, vertexOne.data);
            });
    });

    it('attempt to getDocument by edgeKey on non existing collection should fail', async () => {
        try {
            await testDb.getDocument(edgeCollectionName, edgeOne._key);
        } catch (error) {
            assert.isTrue(error.toString().indexOf('ArangoError: collection not found: ot_edges') >= 0);
        }
    });

    it('getDocument() by edgeKey should give back edge itself', async () => {
        // precondition
        await testDb.createEdgeCollection(edgeCollectionName);
        await testDb.addEdge(edgeOne);

        await testDb.getDocument(edgeCollectionName, edgeOne._key).then((response) => {
            // eslint-disable-next-line no-underscore-dangle
            assert.equal(response._from, edgeOne._from);
            // eslint-disable-next-line no-underscore-dangle
            assert.equal(response._to, edgeOne._to);
            // eslint-disable-next-line no-underscore-dangle
            assert.equal(response._key, edgeOne._key);
        });
    });

    it('getDocument() by vertexKey should give back vertex itself', async () => {
        // precondition
        await testDb.createCollection(documentCollectionName);
        await testDb.addVertex(vertexOne);

        await testDb.getDocument(documentCollectionName, vertexOne._key).then((response) => {
            assert.deepEqual(response._key, vertexOne._key);
            assert.deepEqual(response.data, vertexOne.data);
        });
    });

    it('getDocument() by edgeKey should give back edge itself', async () => {
        // precondition
        await testDb.createEdgeCollection(edgeCollectionName);
        await testDb.addEdge(edgeOne);

        await testDb.getDocument(edgeCollectionName, edgeOne._key).then((response) => {
            // eslint-disable-next-line no-underscore-dangle
            assert.equal(response._from, edgeOne._from);
            // eslint-disable-next-line no-underscore-dangle
            assert.equal(response._to, edgeOne._to);
            // eslint-disable-next-line no-underscore-dangle
            assert.equal(response._key, edgeOne._key);
        });
    });

    it('updateImports() should add/append data', async () => {
        // precondition
        await testDb.createEdgeCollection(edgeCollectionName);
        await testDb.addEdge(edgeOne);

        // this will implicitly call testDb.updateDocument()
        await testDb.updateImports(
            edgeCollectionName,
            // eslint-disable-next-line no-underscore-dangle
            edgeOne._key, newImportValue,
        ).then((response) => {
            assert.containsAllKeys(response, ['_id', '_key', '_rev']);
        });

        // check value of imports
        await testDb.getDocument(edgeCollectionName, edgeOne._key).then((response) => {
            assert.include(response.imports, newImportValue);
        });
    });

    it('updateDocument() should also add/append data', async () => {
        // precondition
        await testDb.createEdgeCollection(edgeCollectionName);
        await testDb.addEdge(edgeOne);

        const updatetedEdgeOne = {
            _key: '6eb743d84a605b2ab6be67a373b883d4',
            edge_type: 'OWNED_BY',
            data_provider: 'WALLET_ID',
            imports: [1520345631, 1234567890],
            _from: 'ot_vertices/2e0b1ba163be76138d51a0b8258e97d7',
            _to: 'ot_vertices/cd923bec4266a7f63b68722da254f205',
        };

        await testDb.updateDocument(
            edgeCollectionName,
            // eslint-disable-next-line no-underscore-dangle
            updatetedEdgeOne,
        );

        // check value of new imports
        await testDb.getDocument(edgeCollectionName, edgeOne._key).then((response) => {
            assert.isTrue(response.imports.length === 2);
        });
    });

    it('findVerticesByImportId() ', async () => {
        // precondition
        await testDb.createCollection(documentCollectionName);
        await testDb.addVertex(vertexOne);

        await testDb.findVerticesByImportId(vertexOne.imports[0]).then((response) => {
            assert.deepEqual(response[0].data, vertexOne.data);
            assert.deepEqual(response[0].vertex_type, vertexOne.vertex_type);
            assert.deepEqual(response[0].identifiers, vertexOne.identifiers);
            assert.deepEqual(response[0].vertex_key, vertexOne.vertex_key);
            assert.deepEqual(response[0].imports, vertexOne.imports);
            assert.deepEqual(response[0].data_provider, vertexOne.data_provider);
        });
    });

    it('findVerticesByImportId() with valid string importId value ', async () => {
        // precondition
        await testDb.createCollection(documentCollectionName);
        await testDb.addVertex(vertexOne);

        await testDb.findVerticesByImportId(vertexOne.imports[0].toString()).then((response) => {
            assert.deepEqual(response[0].data, vertexOne.data);
            assert.deepEqual(response[0].vertex_type, vertexOne.vertex_type);
            assert.deepEqual(response[0].identifiers, vertexOne.identifiers);
            assert.deepEqual(response[0].vertex_key, vertexOne.vertex_key);
            assert.deepEqual(response[0].imports, vertexOne.imports);
            assert.deepEqual(response[0].data_provider, vertexOne.data_provider);
        });
    });

    it('findEdgesByImportId() with valid string importId value', async () => {
        // precondition
        await testDb.createEdgeCollection(edgeCollectionName);
        await testDb.addEdge(edgeOne);

        await testDb.findEdgesByImportId(edgeOne.imports[0].toString()).then((response) => {
            assert.deepEqual(response[0]._key, edgeOne._key);
            assert.deepEqual(response[0].edge_type, edgeOne.edge_type);
            assert.deepEqual(response[0].data_provider, edgeOne.data_provider);
            assert.deepEqual(response[0].imports, edgeOne.imports);
            assert.deepEqual(response[0]._from, edgeOne._from);
            assert.deepEqual(response[0]._to, edgeOne._to);
            assert.deepEqual(response[0].sender_id, edgeOne.sender_id);
        });
    });

    it('.findVertices() with empty query should fail', async () => {
        try {
            await testDb.findVertices();
        } catch (error) {
            // Utilities.isEmptyObject() will complain
            assert.isTrue(error.toString().indexOf('Cannot convert undefined or null to object') >= 0);
        }
    });

    it('.findVertices() on top of empty collection should find nothing', async () => {
        // precondition
        await testDb.createCollection(documentCollectionName);

        const queryObject = {
            uid: '123',
            vertex_type: 'BATCH',
        };
        await testDb.findVertices(queryObject).then((response) => {
            assert.isEmpty(response);
            assert.isTrue(typeof (response) === 'object');
        });
    });

    it('.findTraversalPath() with non valid startVertex should fail', async () => {
        // precondition
        await testDb.createCollection(documentCollectionName);
        await testDb.addVertex(vertexOne);

        const myStartVertex = {
            _id: undefined,
        };
        try {
            const response = await testDb.findTraversalPath(myStartVertex);
            assert.isEmpty(response);
            assert.isTrue(typeof (response) === 'object');
        } catch (error) {
            console.log(error);
        }
    });

    it('.findTraversalPath() with non existing startVertex should fail', async () => {
        // precondition
        await testDb.createCollection(documentCollectionName);
        await testDb.addVertex(vertexOne);

        const myStartVertex = {
            _id: 0,
        };

        try {
            const response = await testDb.findTraversalPath(myStartVertex, 1);
        } catch (error) {
            assert.equal(error.code, 404);
        }
    });

    it('findEvent', async () => {
        // precondition
        await testDb.createCollection(documentCollectionName);
        await testDb.addVertex(vertexOne);

        const response = await testDb.findEvent('senderID', ['a'], '1000', 'bizTest');
        assert.deepEqual(response[0].data, vertexOne.data);
        assert.deepEqual(response[0].vertex_type, vertexOne.vertex_type);
        assert.deepEqual(response[0].identifiers, vertexOne.identifiers);
        assert.deepEqual(response[0].vertex_key, vertexOne.vertex_key);
        assert.deepEqual(response[0].imports, vertexOne.imports);
        assert.deepEqual(response[0].data_provider, vertexOne.data_provider);
        assert.deepEqual(response[0].sender_id, vertexOne.sender_id);
        assert.deepEqual(response[0].partner_id, vertexOne.partner_id);
    });

    it('should add version to identified vertex', async () => {
        // precondition
        await testDb.createCollection(documentCollectionName);

        const dummyVertex = {
            _key: 'dummyKey',
            identifiers: {
                id: 'dummyId',
                uid: 'dummyUid',
            },
            sender_id: 'dummySenderId',
        };
        const response = await testDb.addVertex(dummyVertex);
        expect(response).to.include.all.keys('_id', '_key', '_rev');
        expect(dummyVertex).to.have.property('version', 1);
    });

    it('should increase version to already versioned vertex', async () => {
        // precondition
        await testDb.createCollection(documentCollectionName);

        const dummyVertex = {
            _key: 'dummyKey2',
            identifiers: {
                id: 'dummyId2',
                uid: 'dummyUid2',
            },
            sender_id: 'dummySenderId2',
        };
        let response = await testDb.addVertex(dummyVertex);
        expect(response).to.include.all.keys('_id', '_key', '_rev');
        expect(dummyVertex).to.have.property('version', 1);

        // Change key
        dummyVertex._key = 'dummyChangedKey';

        response = await testDb.addVertex(dummyVertex);
        expect(response).to.include.all.keys('_id', '_key', '_rev');
        expect(dummyVertex).to.have.property('version', 2);
    });

    it('should leave version as is to already versioned vertex', async () => {
        // precondition
        await testDb.createCollection(documentCollectionName);

        const dummyVertex = {
            _key: 'dummyKey3',
            identifiers: {
                id: 'dummyId3',
                uid: 'dummyUid3',
            },
            sender_id: 'dummySenderId3',
        };
        let response = await testDb.addVertex(dummyVertex);
        expect(response).to.include.all.keys('_id', '_key', '_rev');
        expect(dummyVertex).to.have.property('version', 1);

        response = await testDb.addVertex(dummyVertex);
        expect(response).to.include.all.keys('_id', '_key', '_rev');
        expect(dummyVertex).to.have.property('version', 1);
    });

    it('should ignore version for vertices without sender ID and UID', async () => {
        // precondition
        await testDb.createCollection(documentCollectionName);

        let dummyVertex = {
            _key: 'dummyKey4',
            identifiers: {
                id: 'dummyId4',
            },
            sender_id: 'dummySenderId4',
        };
        let response = await testDb.addVertex(dummyVertex);
        expect(response).to.include.all.keys('_id', '_key', '_rev');
        expect(dummyVertex).to.not.have.property('version');

        dummyVertex = {
            _key: 'dummyKey5',
            identifiers: {
                id: 'dummyId5',
                uid: 'dummyUid5',
            },
        };
        response = await testDb.addVertex(dummyVertex);
        expect(response).to.include.all.keys('_id', '_key', '_rev');
        expect(dummyVertex).to.not.have.property('version');

        dummyVertex = {
            _key: 'dummyKey6',
            identifiers: {
                id: 'dummyId6',
            },
        };
        response = await testDb.addVertex(dummyVertex);
        expect(response).to.include.all.keys('_id', '_key', '_rev');
        expect(dummyVertex).to.not.have.property('version');
    });

    after('drop testDb db', async () => {
        systemDb = new Database();
        systemDb.useBasicAuth('root', 'root');
        await systemDb.dropDatabase(myDatabaseName);
    });
});
