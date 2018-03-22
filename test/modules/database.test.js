const {
    describe, before, after, it,
} = require('mocha');
const { assert, expect } = require('chai');
const utilities = require('../../modules/utilities')();

const config = utilities.getConfig();
const database = require('../../modules/database')();
// eslint-disable-next-line  prefer-destructuring
const Database = require('arangojs').Database;

const myUserName = config.DB_USERNAME;
const myPassword = config.DB_PASSWORD;
const myDatabase = config.DB_DATABASE;
const documentCollectionName = 'ot_vertices';
const edgeCollectionName = 'ot_edges';

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

    it('check some basics', async () => {
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

    it.skip('.addVertex() should save item in doc collection', async () => {

    });

    it.skip('.addEdge() should save item in edge collection', async () => {

    });
});
