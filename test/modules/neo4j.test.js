const {
    describe, before, after, it, afterEach,
} = require('mocha');
const { assert, expect } = require('chai');

const Neo4j = require('../../modules/Database/Neo4j.js');
const databaseData = require('./test_data/database-data.js');

const myUsername = 'neo4j';
const myPassword = 'neo4j';
const myDatabaseName = 'testDb';
const host = 'localhost';
const port = '7687';

const vertexOne = databaseData.vertices[0];
const vertexTwo = databaseData.vertices[1];

const edgeOne = databaseData.edges[0];

let testDb;

describe('Neo4j module ', async () => {
    before('create and use testDb db', async () => {
        // TODO kreirati novu bazu

        testDb = new Neo4j(myUsername, myPassword, myDatabaseName, host, port);
    });

    it('.identify() should return correct name', () => {
        assert(testDb.identify(), 'Neo4j');
    });

    it('pass null for vertex', async () => {
        await testDb.addDocument('ot_vertices', null).catch((err) => {
            assert.equal(err.message, 'Invalid vertex null');
        });
    });
    it('pass empty for vertex', async () => {
        await testDb.addDocument('ot_vertices', {}).catch((err) => {
            assert.equal(err.message, 'Invalid vertex {}');
        });
    });
    it('pass regular for vertex', async () => {
        await testDb.addDocument('ot_vertices', vertexOne).then(() => {
            testDb.findVertices({ _key: vertexOne._key }).then((result) => {
                assert.deepEqual(vertexOne, result[0]);
            });
        });
    });
    it('.findTraversalPath() with regular vertices', async () => {
        await testDb.addDocument('ot_vertices', vertexOne);
        await testDb.addDocument('ot_vertices', vertexTwo);
        await testDb.addDocument('ot_edges', edgeOne);

        const path = await testDb.findTraversalPath(vertexOne, 2);
        assert.equal(path.length, 2);
    });

    it('.findTraversalPath() non existing starting vertex', async () => {
        const startVertex = {
            _key: '-1',
        }

        const path = await testDb.findTraversalPath(startVertex, 1);
        assert.equal(path, '');
    });

    it('.findTraversalPath() less than max length', async () => {
        const vertices = [{ data: 'A', _key: '100' }, { data: 'B', _key: '101' }, { data: 'C', _key: '102' }];
        const edges = [{ edgeType: 'IS', _from: '100', _to: '101' }, { edgeType: 'IS', _from: '101', _to: '102' }];

        await testDb.addDocument('ot_vertices', vertices[0]);
        await testDb.addDocument('ot_vertices', vertices[1]);
        await testDb.addDocument('ot_vertices', vertices[2]);
        await testDb.addDocument('ot_edges', edges[0]);
        await testDb.addDocument('ot_edges', edges[1]);

        const path = await testDb.findTraversalPath({ _key: '100' }, 2);
        assert.equal(path.length, 2);
    });

    it('.findTraversalPath() with max length', async () => {
        const vertices = [
            { data: 'A', _key: '100' },
            { data: 'B', _key: '101' },
            { data: 'C', _key: '102' },
            { data: 'D', _key: '103' }];
        const edges = [
            { edgeType: 'IS', _from: '100', _to: '101' },
            { edgeType: 'IS', _from: '101', _to: '102' },
            { edgeType: 'IS', _from: '102', _to: '103' },
            { edgeType: 'IS', _from: '101', _to: '103' }];

        await testDb.addDocument('ot_vertices', vertices[0]);
        await testDb.addDocument('ot_vertices', vertices[1]);
        await testDb.addDocument('ot_vertices', vertices[2]);
        await testDb.addDocument('ot_vertices', vertices[3]);
        await testDb.addDocument('ot_edges', edges[0]);
        await testDb.addDocument('ot_edges', edges[1]);
        await testDb.addDocument('ot_edges', edges[2]);
        await testDb.addDocument('ot_edges', edges[3]);

        const path = await testDb.findTraversalPath({ _key: '100' }, 1000);
        assert.equal(path.length, 4);
    });

    afterEach('clear testDb db', async () => {
        await testDb.clear();
    });

    after('drop testDb db', async () => {
        testDb.close();
    });
});

