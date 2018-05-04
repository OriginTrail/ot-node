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

    it('.createVertex() should create Vertex', () => {

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

    // it('.findTraversalPath() with non existing starting vertex', async () => {
    //     const startVertex = {
    //         _key: '-1',
    //     }
    //
    //     const path = await testDb.findTraversalPath(startVertex, null);
    //     assert.equal(path, '');
    // });

    it('.findTraversalPath() full length', async () => {
        const vertices = [{
            data: 'A node',
            _key: '0',
        },
        {
            data: 'B node',
            _key: '1',
        },
        {
            data: 'C node',
            _key: '2',
        }];

        const edges = [{
            _from: '0',
            _to: '1',
        },
        {
            _from: '1',
            _to: '2',
        },
        ];

        await testDb.addDocument('ot_vertices', vertices[0]);
        await testDb.addDocument('ot_vertices', vertices[1]);
        await testDb.addDocument('ot_vertices', vertices[2]);
        await testDb.addDocument('ot_edges', edges[0]);
        await testDb.addDocument('ot_edges', edges[1]);

        const path = await testDb.findTraversalPath({ _key: '0' }, 3);
        console.log(JSON.stringify(path));
        assert.equal(path.length, 3);
    });

    it('.createEdge(edge) should create Edge', () => {
    });

    /*    afterEach('clear testDb after each test', async () => {
        await testDb.clear();
    }); */

    afterEach('drop testDb db', async () => {
        await testDb.clear();
        testDb.close();
    });
});

