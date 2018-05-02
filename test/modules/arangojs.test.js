const {
    describe, before, after, it,
} = require('mocha');
const { assert, expect } = require('chai');
const ArangoJs = require('../../modules/Database/Arangojs');
const databaseData = require('./test_data/database-data.js');
// eslint-disable-next-line  prefer-destructuring
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
let db;

describe('Arangojs module ', async () => {
    before('create and use testDb db', async () => {
        systemDb = new Database();
        systemDb.useBasicAuth('root', 'root');
        await systemDb.createDatabase(
            myDatabaseName,
            [{ username: myUserName, passwd: myPassword, active: true }],
        );
        testDb = new ArangoJs(myUserName, myPassword, myDatabaseName, '127.0.0.1', '8529');
    });

    it('.identify() should return correct name', () => {
        assert(testDb.identify(), 'ArangoJS');
    });

    it('should see one system and one custom database', async () => {
        expect(testDb.db.name).to.be.equal('testDb');
        expect(systemDb).to.be.an.instanceof(Database);
        const listOfDatabases = await testDb.db.listDatabases();
        assert.equal(listOfDatabases[0], '_system');
        assert.equal(listOfDatabases[1], 'testDb');
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
        assert.equal(info.length, 2);
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

    it('.addDocument() should save vertex in Document Collection', () => {
        testDb.addDocument(documentCollectionName, vertexOne).then((response) => {
            assert.containsAllKeys(response, ['_id', '_key', '_rev']);
        });
    });

    it('now lets check that we\'ve really saved vertex data', async () => {
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

    it('trying to add same document again should resut in double insert', () => {
        testDb.addDocument(documentCollectionName, vertexOne).then((response) => {
            assert.equal(response, 'Double insert');
        });
    });

    it('trying to add null document', async () => {
        try {
            await testDb.addDocument(documentCollectionName, null);
        } catch (error) {
            assert.isTrue(error.toString().indexOf('ArangoError: invalid document type') >= 0);
        }
    });

    it('.addDocument() should save edge in Edge Document Collection', () => {
        testDb.addDocument(edgeCollectionName, edgeOne).then((response) => {
            assert.containsAllKeys(response, ['_id', '_key', '_rev']);
        });
    });

    it('now lets check that we\'ve saved edge correctly', async () => {
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

    it('updateDocumentImports() should add/append data', async () => {
        // this will implicitly call testDb.updateDocument()
        await testDb.updateDocumentImports(
            edgeCollectionName,
            // eslint-disable-next-line no-underscore-dangle
            edgeOne._key, newImportValue,
        ).then((response) => {
            assert.containsAllKeys(response, ['_id', '_key', '_rev', '_oldRev']);
        });

        // check value of imports
        await testDb.getDocument(edgeCollectionName, edgeOne._key).then((response) => {
            assert.include(response.imports, newImportValue);
        });
    });

    it('getDocument() by vertexKey should give back vertex itself', async () => {
        await testDb.getDocument(documentCollectionName, vertexOne._key)
            .then((response) => {
                assert.deepEqual(response._key, vertexOne._key);
                assert.deepEqual(response.data, vertexOne.data);
            });
    });

    it('attempt to getDocument on non existing db should fail', async () => {
        try {
            await testDb.getDocument(documentCollectionName, vertexOne._key);
        } catch (error) {
            assert.isTrue(error.toString().indexOf('Error: Not connected to graph database') >= 0);
        }
    });

    it('attempt to getDocument by edgeKey on non existing collection should fail', async () => {
        try {
            await testDb.getDocument(edgeCollectionName, edgeOne._key);
        } catch (error) {
            assert.isTrue(error.toString().indexOf('ArangoError: collection not found: ot_edges') >= 0);
        }
    });

    it('getDocument() by edgeKey should give back edge itself', async () => {
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
        await testDb.getDocument(documentCollectionName, vertexOne._key).then((response) => {
            assert.deepEqual(response._key, vertexOne._key);
            assert.deepEqual(response.data, vertexOne.data);
        });
    });

    it('getDocument() by edgeKey should give back edge itself', async () => {
        await testDb.getDocument(edgeCollectionName, edgeOne._key).then((response) => {
            // eslint-disable-next-line no-underscore-dangle
            assert.equal(response._from, edgeOne._from);
            // eslint-disable-next-line no-underscore-dangle
            assert.equal(response._to, edgeOne._to);
            // eslint-disable-next-line no-underscore-dangle
            assert.equal(response._key, edgeOne._key);
        });
    });

    it('updateDocumentImports() should add/append data', async () => {
        // this will implicitly call testDb.updateDocument()
        await testDb.updateDocumentImports(
            edgeCollectionName,
            // eslint-disable-next-line no-underscore-dangle
            edgeOne._key, newImportValue,
        ).then((response) => {
            assert.containsAllKeys(response, ['_id', '_key', '_rev', '_oldRev']);
        });

        // check value of imports
        await testDb.getDocument(edgeCollectionName, edgeOne._key).then((response) => {
            assert.include(response.imports, newImportValue);
        });
    });

    it('updateDocument() should also add/append data', async () => {
        const updatetedEdgeOne = {
            _key: '6eb743d84a605b2ab6be67a373b883d4',
            edge_type: 'OWNED_BY',
            data_provider: 'WALLET_ID',
            imports: [1520345631, 1234567890],
            _from: 'ot_vertices/2e0b1ba163be76138d51a0b8258e97d7',
            _to: 'ot_vertices/cd923bec4266a7f63b68722da254f205',
        };

        try {
            testDb.updateDocument(
                edgeCollectionName,
                // eslint-disable-next-line no-underscore-dangle
                updatetedEdgeOne,
            );
        } catch (error) {
            console.log(error);
        }

        // check value of new imports
        await testDb.getDocument(edgeCollectionName, edgeOne._key).then((response) => {
            assert.isTrue(response.imports.length === 2);
        });
    });

    it('getVerticesByImportId() ', async () => {
        await testDb.getVerticesByImportId(vertexOne.imports[0]).then((response) => {
            assert.deepEqual(response[0].data, vertexOne.data);
            assert.deepEqual(response[0].vertex_type, vertexOne.vertex_type);
            assert.deepEqual(response[0].identifiers, vertexOne.identifiers);
            assert.deepEqual(response[0].vertex_key, vertexOne.vertex_key);
            assert.deepEqual(response[0].imports, vertexOne.imports);
            assert.deepEqual(response[0].data_provider, vertexOne.data_provider);
        });
    });

    it('getVerticesByImportId() with valid string importId value ', async () => {
        await testDb.getVerticesByImportId(vertexOne.imports[0].toString()).then((response) => {
            assert.deepEqual(response[0].data, vertexOne.data);
            assert.deepEqual(response[0].vertex_type, vertexOne.vertex_type);
            assert.deepEqual(response[0].identifiers, vertexOne.identifiers);
            assert.deepEqual(response[0].vertex_key, vertexOne.vertex_key);
            assert.deepEqual(response[0].imports, vertexOne.imports);
            assert.deepEqual(response[0].data_provider, vertexOne.data_provider);
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

    it('.findVertices() when still not connected to graph db should fail', async () => {
        const queryObject = {
            uid: '123',
            vertex_type: 'BATCH',
        };
        try {
            const result = await testDb.findVertices(queryObject);
        } catch (error) {
            assert.isTrue(error.toString().indexOf('Error: Not connected to graph database') >= 0);
        }
    });

    it('.findVertices() on top of empty collection should find nothing', async () => {
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
        // db alredy connected and ot_vertices exists
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
        // db alredy connected and ot_vertices exists
        const myStartVertex = {
            _id: 0,
        };

        try {
            const response = await testDb.findTraversalPath(myStartVertex, 1);
        } catch (error) {
            assert.equal(error.code, 404);
        }
    });

    after('drop testDb db', async () => {
        systemDb = new Database();
        systemDb.useBasicAuth('root', 'root');
        await systemDb.dropDatabase(myDatabaseName);
    });
});

