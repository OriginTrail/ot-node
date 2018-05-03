const {
    describe, before, after, it,
} = require('mocha');
const { assert, expect } = require('chai');

const Neo4j = require('../../modules/Database/Neo4j.js');
const databaseData = require('./test_data/database-data.js');
const stringify = require('json-stable-stringify');


const myUsername = 'neo4j';
const myPassword = 'otpass';
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
        //TODO kreirati novu bazu

        testDb = new Neo4j(myUsername, myPassword, myDatabaseName, host, port);
    });

    it('.identify() should return correct name', () => {
        assert(testDb.identify(), 'Neo4j');
    });

    it('.createVertex() should create Vertex', () => {

    });

    it('create and retrieve vertices', () => {
        testDb.createVertex(vertexOne).then(() => {
            testDb.findVertices(vertexOne._key).then((result) => {
                assert.equal(stringify(vertexOne), result)
            })
        })
    })

    it('.createEdge(edge) should create Edge', () => {

    });

    it('_transformProperty() should transform Neo4j property to Javascript compatible one'), () => {

    }


    after('drop testDb db', async () => {
        /*systemDb = new Database();
        systemDb.useBasicAuth('root', 'root');
        await systemDb.dropDatabase(myDatabaseName);*/
        session.close();
        driver.close();

    });
});

