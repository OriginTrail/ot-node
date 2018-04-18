const {
    describe, it, after, before,
} = require('mocha');
const { assert, expect } = require('chai');
var models = require('../../models');
const deasync = require('deasync-promise');
const Utilities = require('../../modules/Utilities');
const Storage = require('../../modules/Storage');
// eslint-disable-next-line  prefer-destructuring
const Database = require('arangojs').Database;
const ArangoJs = require('../../modules/Database/Arangojs');
const GraphStorage = require('../../modules/Database/GraphStorage');
const databaseData = require('./test_data/database-data.js');

const myUserName = 'otuser';
const myPassword = 'otpass';
const myDatabaseName = 'test_origintrail';

const documentCollectionName = 'ot_vertices';
const edgeCollectionName = 'ot_edges';
const vertexOne = databaseData.vertices[0];
const vertexTwo = databaseData.vertices[1];
const edgeOne = databaseData.edges[0];
const newImportValue = 2520345631;

let selectedDatabase;
let systemDb;
let myGraphStorage;
let myGraphStorageConnection;

describe('GraphStorage module', () => {
    before('loadSelectedDatabaseInfo()', async () => {
        Storage.models = deasync(models.sequelize.sync()).models;
        selectedDatabase = await Utilities.loadSelectedDatabaseInfo();
        assert.hasAllKeys(selectedDatabase, ['id', 'database_system', 'username', 'password',
            'host', 'port', 'max_path_length', 'database']);
        selectedDatabase.database = myDatabaseName;

        systemDb = new Database();
        systemDb.useBasicAuth('root', 'root');
        await systemDb.createDatabase(
            myDatabaseName,
            [{ username: myUserName, passwd: myPassword, active: true }],
        );

        myGraphStorage = new GraphStorage(selectedDatabase);
    });

    it('connect() and identify()', async () => {
        myGraphStorageConnection = await myGraphStorage.connect();
        // TODO meaningful checks for connect()

        assert.equal(myGraphStorage.identify(), 'ArangoJS');
        assert.equal(myGraphStorage.db.identify(), 'ArangoJS');
    });

    it('getDatabaseInfo() ', () => {
        const result = myGraphStorage.getDatabaseInfo();
        assert.equal(result, selectedDatabase);
    });

    it('.runQuery() should give back result', async () => {
        const now = Date.now();
        await myGraphStorage.runQuery('RETURN @value', { value: now }).then((response) => {
            assert.approximately(response[0], now, 1000, 'Resulted time is approx same as current');
        });
    });

    it('.createCollection() should create Document Collection', async () => {
        // first time creating Document Collection
        await myGraphStorage.createCollection(documentCollectionName).then((response) => {
            assert.equal(response, 'Collection created');
        });
        const myCollection = myGraphStorage.db.db.collection(documentCollectionName);
        const data = await myCollection.get();
        assert.equal(data.code, 200);
        assert.isFalse(data.isSystem);
        assert.equal(data.name, documentCollectionName);
        const info = await myGraphStorage.db.db.listCollections();
        assert.equal(info.length, 1);
    });

    it('.createEdgeCollection() should create Edge Collection', async () => {
        // first time creating Edge Collection
        await myGraphStorage.createEdgeCollection(edgeCollectionName).then((response) => {
            assert.equal(response, 'Edge collection created');
        });

        const myCollection = myGraphStorage.db.db.collection(edgeCollectionName);
        const data = await myCollection.get();
        assert.equal(data.code, 200);
        assert.isFalse(data.isSystem);
        assert.equal(data.name, edgeCollectionName);
        const info = await myGraphStorage.db.db.listCollections();
        assert.equal(info.length, 2);
    });

    it('.addVertex() should save vertex in Document Collection', () => {
        myGraphStorage.addVertex(documentCollectionName, vertexOne).then((response) => {
            assert.containsAllKeys(response, ['_id', '_key', '_rev']);
        });
    });

    it('.addEdge() should save edge in Edge Document Collection', () => {
        myGraphStorage.addEdge(edgeCollectionName, edgeOne).then((response) => {
            assert.containsAllKeys(response, ['_id', '_key', '_rev']);
        });
    });

    it('getDocument() by vertexKey should give back vertex itself', async () => {
        await myGraphStorage.getDocument(documentCollectionName, vertexOne._key)
            .then((response) => {
                assert.deepEqual(response._key, vertexOne._key);
                assert.deepEqual(response.data, vertexOne.data);
            });
    });

    it('getDocument() by edgeKey should give back edge itself', async () => {
        await myGraphStorage.getDocument(edgeCollectionName, edgeOne._key).then((response) => {
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
        await myGraphStorage.updateDocumentImports(
            edgeCollectionName,
            // eslint-disable-next-line no-underscore-dangle
            edgeOne._key, newImportValue,
        ).then((response) => {
            assert.containsAllKeys(response, ['_id', '_key', '_rev', '_oldRev']);
        });

        // check value of imports
        await myGraphStorage.getDocument(edgeCollectionName, edgeOne._key).then((response) => {
            assert.include(response.imports, newImportValue);
        });
    });

    it('getVerticesByImportId() ', async () => {
        await myGraphStorage.getVerticesByImportId(vertexOne.imports[0]).then((response) => {
            assert.deepEqual(response[0].data, vertexOne.data);
            assert.deepEqual(response[0].vertex_type, vertexOne.vertex_type);
            assert.deepEqual(response[0].identifiers, vertexOne.identifiers);
            assert.deepEqual(response[0].vertex_key, vertexOne.vertex_key);
            assert.deepEqual(response[0].imports, vertexOne.imports);
            assert.deepEqual(response[0].data_provider, vertexOne.data_provider);
        });
    });

    after('drop myGraphStorage db', async () => {
        systemDb = new Database();
        systemDb.useBasicAuth('root', 'root');
        await systemDb.dropDatabase(myDatabaseName);
    });
});
