const {
    describe, before, after, it,
} = require('mocha');
const { assert, expect } = require('chai');
const utilities = require('../../modules/utilities')();
const database = require('../../modules/database')();
const databaseData = require('./test_data/database-data.js');
// eslint-disable-next-line  prefer-destructuring
const Database = require('arangojs').Database;

const config = utilities.getConfig();

const myUserName = config.DB_USERNAME;
const myPassword = config.DB_PASSWORD;
const myDatabase = config.DB_DATABASE;
const documentCollectionName = 'ot_vertices';
const edgeCollectionName = 'ot_edges';
const vertexOne = databaseData.vertices[0];
const vertexTwo = databaseData.vertices[1];
const edgeOne = databaseData.edges[0];

let systemDb;
let otnode;
let db;

describe('Database module ', async () => {
    before('create and use otnode db', async () => {
        systemDb = new Database();
        otnode = await systemDb.createDatabase(
            myDatabase,
            [{ username: myUserName, passwd: myPassword, active: true }],
        );
        // this should start using otnode
        db = database.getConnection();
        assert(db.name, myDatabase);
    });

    after('drop otnode db', async () => {
        systemDb = new Database();
        await systemDb.dropDatabase(myDatabase);
    });

    it('should see one system and one custom database', async () => {
        expect(systemDb.name).to.be.equal('_system');
        const listOfDatabases = await systemDb.listDatabases();
        assert.equal(listOfDatabases[0], '_system');
        assert.equal(listOfDatabases[1], 'otnode');
    });

    it('.runQuery() should give back result', async () => {
        const now = Date.now();

        await database.runQuery('RETURN @value', (result) => {
            assert.approximately(result[0], now, 1000, 'Resulted time is approx same as current');
        }, { value: now });
    });

    it('.createVertexCollection() should create Document Collection', async () => {
        // first time creating Document Collection
        await database.createVertexCollection(documentCollectionName, (response) => {
            assert.equal(response, true, 'doc collection should be created');
        });

        // this will cover 409 path
        await database.createVertexCollection(documentCollectionName, (response) => {
            assert.equal(response, true, 'doc collection has already been created');
        });

        const myCollection = db.collection(documentCollectionName);
        const data = await myCollection.get();
        assert.equal(data.code, 200);
        assert.isFalse(data.isSystem);
        assert.equal(data.name, documentCollectionName);
        const info = await db.listCollections();
        assert.equal(info.length, 1);
    });

    it('.createEdgeCollection() should create Edge Collection', async () => {
        // first time creating Edge Collection
        await database.createEdgeCollection(edgeCollectionName, (response) => {
            assert.equal(response, true, 'edge collection has already been created');
        });

        // this will cover 409 path
        await database.createEdgeCollection(edgeCollectionName, (response) => {
            assert.equal(response, true, 'edge collection has already been created');
        });

        const myCollection = db.collection(edgeCollectionName);
        const data = await myCollection.get();
        assert.equal(data.code, 200);
        assert.isFalse(data.isSystem);
        assert.equal(data.name, edgeCollectionName);
        const info = await db.listCollections();
        assert.equal(info.length, 2);
    });

    it('.addVertex() should save item in Document Collection', (done) => {
        database.addVertex(documentCollectionName, vertexOne, (response) => {
            assert.isTrue(response, 'We should be able to save vertex in document collection');
            done();
        });
    });

    it('now lets check that we\'ve saved vertex correctly', async () => {
        const myCollection = db.collection(documentCollectionName);
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

    it('.addEdge() should save item in Edge Document Collection', (done) => {
        database.addEdge(edgeCollectionName, edgeOne, (response) => {
            assert.isTrue(response, 'We should be able to save edge in edge document collection');
            done();
        });
    });

    it('now lets check that we\'ve saved edge correctly', async () => {
        const myCollection = db.edgeCollection(edgeCollectionName);
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
});
