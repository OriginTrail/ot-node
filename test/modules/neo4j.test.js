const {
    describe, before, after, it,
} = require('mocha');
const { assert, expect } = require('chai');

const Neo4j = require('../../modules/Database/Neo4j.js');
const databaseData = require('./test_data/database-data.js');
const stringify = require('json-stable-stringify');
const deasync = require('deasync-promise');

const myUsername = 'neo4j';
const myPassword = 'neo4j';
const myDatabaseName = 'testDb';
const host = 'localhost';
const port = '7687';

const vertexOne = databaseData.vertices[0];
const vertexTwo = databaseData.vertices[1];

const edgeOne = databaseData.edges[0];
const newImportValue = 2520345631;
const oneMoreImportValue = 2520345639;

let systemDb;
let testDb;
let db;

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

    it('pass null for vertex', () => {
        deasync(testDb.addDocument('ot_vertices', null).then((res) => {
            throw new Error('Vertex shouldn\'t be created');
        }).catch((err) => {
            assert.equal(err.message, 'Invalid vertex null');
        }));
    });
    it('pass empty for vertex', () => {
        deasync(testDb.addDocument('ot_vertices', {}).then((res) => {
            throw new Error('Vertex shouldn\'t be created');
        }).catch((err) => {
            assert.equal(err.message, 'Invalid vertex {}');
        }));
    });
    it('pass regular for vertex', () => {
        deasync(testDb.addDocument('ot_vertices', vertexOne).then(() => {
            testDb.findVertices({ _key: vertexOne._key }).then((result) => {
                assert.deepEqual(vertexOne, result[0]);
            }).catch((err) => {
                throw new Error(`Failed to find vertice. ${err}`);
            });
        }).catch((err) => {
            throw new Error(`Failed to create a vertice. ${err}`);
        }));
    });
    it('find traversal', () => {
        const createOne = testDb.addDocument('ot_vertices', vertexOne);
        const createTwo = testDb.addDocument('ot_vertices', vertexTwo);
        const createEdge = testDb.addDocument('ot_edges', edgeOne);

        deasync(Promise.all([createOne, createTwo, createEdge]).then((res) => {
            deasync(testDb.findTraversalPath(vertexOne, 2).then((path) => {
                // compare
            }));
        }));
    });

    it('.createEdge(edge) should create Edge', () => {

    });

    after('drop testDb db', async () => {
        await testDb.clear();
        testDb.close();
        /* systemDb = new Database();
        systemDb.useBasicAuth('root', 'root');
        await systemDb.dropDatabase(myDatabaseName); */
    });
});

