const Utilities = require('../../modules/Utilities');

const {
    describe, before, after, afterEach, it,
} = require('mocha');
const { assert } = require('chai');

const Neo4j = require('../../modules/Database/Neo4j.js');
const databaseData = require('./test_data/neo4j-data.js');

const vertices = [
    { data: 'A', _key: '100', sender_id: 'a' },
    { data: 'B', _key: '101', sender_id: 'a' },
    { data: 'C', _key: '102', sender_id: 'a' },
    { data: 'D', _key: '103', sender_id: 'a' }];
const edges = [
    {
        edgeType: 'IS', _from: '100', _to: '101', sender_id: 'a', uid: '190', _key: '6eb743d84a605b2ab6be67a373b883d4', imports: [1520345631],
    },
    {
        edgeType: 'IS', _from: '101', _to: '102', sender_id: 'b', uid: '200', _key: '6eb743d84a605b2ab6be67a373b883d5',
    },
    {
        edgeType: 'IS', _from: '102', _to: '103', sender_id: 'c',
    },
    {
        edgeType: 'IS', _from: '101', _to: '103', sender_id: 'b',
    }];

const myUsername = process.env.NEO_USERNAME;
const myPassword = process.env.NEO_PASSWORD;
const myDatabaseName = 'testDb';
const host = 'localhost';
const port = '7687';

const vertexOne = databaseData.vertices[0];
const vertexTwo = databaseData.vertices[1];
const vertexOneV2 = databaseData.vertices[2];
const vertexOneV3 = databaseData.vertices[3];

const edgeOne = databaseData.edges[0];

let testDb;

describe.skip('Neo4j module ', async () => {
    before('create and use testDb db', async () => {
        const log = Utilities.getLogger();
        testDb = new Neo4j(myUsername, myPassword, myDatabaseName, host, port, log);
    });

    it('.identify() should return correct name', () => {
        assert(testDb.identify(), 'Neo4j');
    });

    it('pass null for vertex', async () => {
        await testDb.addVertex(null).catch((err) => {
            assert.equal(err.message, 'Invalid vertex null');
        });
    });

    it('pass empty for vertex', async () => {
        await testDb.addVertex({}).catch((err) => {
            assert.equal(err.message, 'Invalid vertex {}');
        });
    });

    it('pass regular for vertex', async function passRegular() {
        this.timeout(30000);
        await testDb.addVertex(vertexOne).then(() => {
            testDb.findVertices({ _key: vertexOne._key }).then((result) => {
                assert.deepEqual(vertexOne, result[0]);
            });
        });
    });

    it('.findVertices() with non existing vertex should find nothing', async () => {
        const queryObject = {
            vertex_key: 'none',
        };
        await testDb.findVertices(queryObject).then((response) => {
            assert.isEmpty(response);
            assert.isTrue(typeof (response) === 'object');
        });
    });

    it('.findTraversalPath() with regular vertices', async () => {
        // predecondition
        await testDb.addVertex(vertexOne);

        await testDb.addVertex(vertexTwo);
        await testDb.addEdge(edgeOne);

        const path = await testDb.findTraversalPath(vertexOne, 1);
        assert.equal(Object.keys(path.data).length, 2);
    });

    it('.findTraversalPath() with non existing starting vertex', async () => {
        const startVertex = {
            _key: '-1',
        };

        const path = await testDb.findTraversalPath(startVertex, 1);
        assert.isEmpty(path.data);
    });

    it('.findTraversalPath() with depth less than max length', async () => {
        await testDb.addVertex(vertices[0]);
        await testDb.addVertex(vertices[1]);
        await testDb.addVertex(vertices[2]);
        await testDb.addVertex(vertices[3]);
        await testDb.addEdge(edges[0]);
        await testDb.addEdge(edges[1]);
        await testDb.addEdge(edges[2]);

        const path = await testDb.findTraversalPath({ _key: '100' }, 2);
        console.log(path);
        assert.equal(Object.keys(path.data).length, 3);
    });

    it('.findTraversalPath() with max length', async () => {
        // predecondition
        await testDb.addVertex(vertexOne);
        await testDb.addVertex(vertexTwo);
        await testDb.addEdge(edgeOne);
        await testDb.addVertex(vertices[0]);
        await testDb.addVertex(vertices[1]);
        await testDb.addVertex(vertices[2]);
        await testDb.addVertex(vertices[3]);
        await testDb.addEdge(edges[0]);
        await testDb.addEdge(edges[1]);
        await testDb.addEdge(edges[2]);

        const path = await testDb.findTraversalPath({ _key: '100' }, 1000);
        assert.equal(Object.keys(path.data).length, 4);
    });

    it('traversal path with interconnected vertices', async () => {
        // predecondition
        await testDb.addVertex(vertexOne);
        await testDb.addVertex(vertexTwo);
        await testDb.addEdge(edgeOne);
        await testDb.addVertex(vertices[0]);
        await testDb.addVertex(vertices[1]);
        await testDb.addVertex(vertices[2]);
        await testDb.addVertex(vertices[3]);
        await testDb.addEdge(edges[0]);
        await testDb.addEdge(edges[1]);
        await testDb.addEdge(edges[2]);

        await testDb.addEdge(edges[3]);

        const path = await testDb.findTraversalPath({ _key: '100' }, 1000);

        console.log(JSON.stringify(path));
        // TODO assert.deepEqual
    });

    it('findVertexWithMaxVersion', async () => {
        await testDb.addVertex(vertexOneV2);
        await testDb.addVertex(vertexOneV3);

        const response = await testDb.findVertexWithMaxVersion('a', vertexOne.identifiers.uid);
        assert.deepEqual(response, vertexOneV3);
    });

    it('findVerticesByImportId', async () => {
        // predecondition
        await testDb.addVertex(vertexOne);
        await testDb.addVertex(vertexTwo);
        await testDb.addEdge(edgeOne);
        await testDb.addVertex(vertices[0]);
        await testDb.addVertex(vertices[1]);
        await testDb.addVertex(vertices[2]);
        await testDb.addVertex(vertices[3]);
        await testDb.addEdge(edges[0]);
        await testDb.addEdge(edges[1]);
        await testDb.addEdge(edges[2]);
        await testDb.addEdge(edges[3]);
        await testDb.addVertex(vertexOneV2);
        await testDb.addVertex(vertexOneV3);

        const response = await testDb.findVerticesByImportId('1520345631');

        function sortByKey(a, b) {
            if (a._key < b._key) {
                return -1;
            }
            if (a._key > b._key) {
                return 1;
            }
            return 0;
        }

        assert.deepEqual(databaseData.vertices.sort(sortByKey), response.sort(sortByKey));
    });


    it('findEvent', async () => {
        // predecondition
        await testDb.addVertex(vertexOne);
        await testDb.addVertex(vertexTwo);
        await testDb.addEdge(edgeOne);
        await testDb.addVertex(vertices[0]);
        await testDb.addVertex(vertices[1]);
        await testDb.addVertex(vertices[2]);
        await testDb.addVertex(vertices[3]);
        await testDb.addEdge(edges[0]);
        await testDb.addEdge(edges[1]);
        await testDb.addEdge(edges[2]);
        await testDb.addEdge(edges[3]);
        await testDb.addVertex(vertexOneV2);
        await testDb.addVertex(vertexOneV3);
        const response = await testDb.findEvent('senderID', 'myID', '1000', 'bizTest');
        assert.deepEqual(response[0], vertexOne);
    });

    it('update document imports', async () => {
        // predecondition
        await testDb.addVertex(vertexOne);
        await testDb.addVertex(vertexTwo);
        await testDb.addEdge(edgeOne);
        await testDb.addVertex(vertices[0]);
        await testDb.addVertex(vertices[1]);
        await testDb.addVertex(vertices[2]);
        await testDb.addVertex(vertices[3]);
        await testDb.addEdge(edges[0]);
        await testDb.addEdge(edges[1]);
        await testDb.addEdge(edges[2]);
        await testDb.addEdge(edges[3]);
        await testDb.addVertex(vertexOneV2);
        await testDb.addVertex(vertexOneV3);

        await testDb.updateImports('ot_vertices', vertexOne._key, 101100);
        const response = await testDb.findVerticesByImportId(101100);

        assert.deepEqual(response[0].data, vertexOne.data);
        assert.deepEqual(response[0].vertex_type, vertexOne.vertex_type);
        assert.deepEqual(response[0].identifiers, vertexOne.identifiers);
        assert.deepEqual(response[0].vertex_key, vertexOne.vertex_key);
        assert.deepEqual(response[0]._key, vertexOne._key);
        assert.deepEqual(response[0].imports, [vertexOne.imports[0], 101100]);
        assert.deepEqual(response[0].data_provider, vertexOne.data_provider);
    });

    it('.updateVertexImportsByUID()', async () => {
        await testDb.addVertex(vertexOne);

        await testDb.updateVertexImportsByUID('myID', vertexOne.identifiers.uid, 11000);
        const response = await testDb.findVerticesByImportId(11000);

        assert.deepEqual(response[0].imports, [vertexOne.imports[0], 11000]);
    });

    it('.updateEdgeImportsByUID()', async () => {
        await testDb.addVertex(vertices[0]);
        await testDb.addVertex(vertices[1]);
        await testDb.addVertex(vertices[2]);
        await testDb.addEdge(edges[0]);
        await testDb.addEdge(edges[1]);

        await testDb.updateEdgeImportsByUID('a', '190', 20080);
        await testDb.updateEdgeImportsByUID('b', '200', 10050);

        const responseOne = await testDb.findEdgesByImportId(20080);
        const responseTwo = await testDb.findEdgesByImportId(10050);

        assert.deepEqual(responseOne[0].imports, [edges[0].imports[0], 20080]);
        assert.deepEqual(responseTwo[0].imports, [10050]);
    });

    afterEach('clear testDb', async () => {
        await testDb.clear();
    });

    after('drop testDb', () => {
        testDb.close();
    });
});

