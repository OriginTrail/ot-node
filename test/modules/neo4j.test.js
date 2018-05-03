const {
    describe, before, after, it,
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

    it('.createVertex() should create Vertex', () => {

    });
    it('pass null for vertex', async () => {
        await testDb.addDocument('ot_vertices', null).then((res) => {
            console.log('should not happen'); // TODO handle
        }).catch((err) => {
            assert.equal(err.message, 'Invalid vertex null');
        });
    });
    it('pass empty for vertex', async () => {
        await testDb.addDocument('ot_vertices', {}).then((res) => {
            console.log('should not happen'); // TODO handle
        }).catch((err) => {
            assert.equal(err.message, 'Invalid vertex {}');
        });
    });
    it('pass regular for vertex', async () => {
        await testDb.addDocument('ot_vertices', vertexOne).then(() => {
            testDb.findVertices({ _key: vertexOne._key }).then((result) => {
                assert.deepEqual(vertexOne, result[0]);
            }).catch((err) => {
                console.log('should not happen'); // TODO handle
            });
        }).catch((err) => {
            console.log('should not happen'); // TODO handle
        });
    });
    it('find traversal', async () => {
        // const createOne = testDb.addDocument('ot_vertices', vertexOne);
        // const createTwo = testDb.addDocument('ot_vertices', vertexTwo);
        // const createEdge = testDb.addDocument('ot_edges', edgeOne);
        //
        // await Promise.all([createOne, createTwo, createEdge]).then((res) => {
        //     testDb.findTraversalPath(vertexOne, 2).then((path) => {
        //         // compare
        //     });
        // });
    });

    it('.createEdge(edge) should create Edge', () => {

    });

    after('drop testDb db', async () => {
        await testDb.clear();
        testDb.close();
    });
});

