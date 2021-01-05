require('dotenv').config();

const {
    describe, it, after, before, beforeEach,
} = require('mocha');
const { assert, expect } = require('chai');
const rc = require('rc');
const models = require('../../models');
const deasync = require('deasync-promise');
const Utilities = require('../../modules/Utilities');
const Storage = require('../../modules/Storage');
const { Database } = require('arangojs');
const GraphStorage = require('../../modules/Database/GraphStorage');
const databaseData = require('./test_data/arangodb-data.js');

const defaultConfig = require('../../config/config.json').development;
const pjson = require('../../package.json');

describe('GraphStorage module', () => {
    let selectedDatabase;
    let systemDb;
    let myGraphStorage;
    let myGraphStorageConnection;
    let myInvalidGraphStorage;
    let myInvalidGraphConnection;

    const myDatabaseName = 'test_origintrail';
    const edgeCollectionName = 'ot_edges';
    const vertexOne = databaseData.vertices[0];
    const vertexTwo = databaseData.vertices[1];
    const vertexThree = databaseData.vertices[2];
    const edgeOne = databaseData.edges[0];
    const edgeTwo = databaseData.edges[1];
    const newImportValue = 2520345631;

    before('Init myGraphStorage', async () => {
        const config = rc(pjson.name, defaultConfig);
        selectedDatabase = config.database;
        selectedDatabase.database = myDatabaseName;
        Storage.models = deasync(models.sequelize.sync()).models;
        selectedDatabase.database = myDatabaseName;

        if (selectedDatabase.provider === 'arangodb') {
            systemDb = new Database();
            systemDb.useBasicAuth(selectedDatabase.username, selectedDatabase.password);
            await systemDb.createDatabase(
                myDatabaseName,
                [{
                    username: selectedDatabase.username,
                    passwd: selectedDatabase.password,
                    active: true,
                }],
            );
        } else {
            throw Error('Not implemented database provider.');
        }

        myGraphStorage = new GraphStorage(selectedDatabase);
        expect(myGraphStorage).to.be.an.instanceof(GraphStorage);
        myGraphStorageConnection = await myGraphStorage.connect();

        myInvalidGraphStorage = new GraphStorage();
    });

    beforeEach('reset ot_vertices and ot_edges collections', async () => {
        if (selectedDatabase.provider === 'arangodb') {
            try {
                await myGraphStorage.db.dropCollection('ot_vertices');
                await myGraphStorage.db.dropCollection('ot_edges');
            } catch (err) {
                console.log('Ooops, there was no collection to drop!!!!');
            }
            try {
                await myGraphStorage.db.createCollection('ot_vertices');
                await myGraphStorage.db.createEdgeCollection('ot_edges');
            } catch (err) {
                console.log('Oops, having difficulties creating collections');
            }
        } else {
            throw Error('Not implemented database provider.');
        }
    });

    it('adding vertex and edges should save in collections', async () => {
        try {
            const res_v1 = await myGraphStorage.addVertex(vertexOne);
            const res_v2 = await myGraphStorage.addVertex(vertexTwo);

            assert.equal(res_v1._key, vertexOne._key);
            assert.equal(res_v2._key, vertexTwo._key);

            const res = await myGraphStorage.addEdge(edgeOne);

            assert.equal(res._key, edgeOne._key);
        } catch (error) {
            assert.isTrue(!!error);
        }
    });

    it('identify()', async () => {
        if (selectedDatabase.provider === 'arangodb') {
            assert.equal(myGraphStorage.identify(), 'ArangoJS');
            assert.equal(myGraphStorage.db.identify(), 'ArangoJS');
        } else {
            throw Error('Not implemented database provider.');
        }
    });

    it('Unable to connect to graph database scenario', async () => {
        try {
            myInvalidGraphConnection = await myInvalidGraphStorage.connect();
        } catch (error) {
            assert.isTrue(error.toString().indexOf('Unable to connect to graph database') >= 0);
        }
    });

    it('getDatabaseInfo() ', () => {
        const result = myGraphStorage.getDatabaseInfo();
        assert.equal(result, selectedDatabase);
    });

    it('attempt to updateImports on non existing db should fail', async () => {
        try {
            await myInvalidGraphStorage.updateImports(
                edgeCollectionName,
                // eslint-disable-next-line no-underscore-dangle
                edgeOne._key, newImportValue,
            );
        } catch (error) {
            assert.isTrue(error.toString().indexOf('Cannot read property \'updateImports\' of undefined') >= 0);
        }
    });

    it('.addVertex() should save vertex in Document Collection', (done) => {
        myGraphStorage.addVertex(vertexOne).then((response) => {
            assert.containsAllKeys(response, ['_key']);
            done();
        });
    });

    it('adding vertex from invalid storage should fail', async () => {
        try {
            const result =
                await myInvalidGraphStorage.addVertex(vertexTwo);
        } catch (error) {
            assert.isTrue(error.toString().indexOf('Not connected to graph database') >= 0);
        }
    });

    it('.addEdge() should save edge in Edge Document Collection', async () => {
        assert.containsAllKeys(await myGraphStorage.addEdge(edgeOne), ['_key']);
    });

    it('findVerticesByImportId() ', async () => {
        // precondition
        await myGraphStorage.addVertex(vertexOne);

        await myGraphStorage.findVerticesByImportId(vertexOne.datasets[0]).then((response) => {
            const vertexOneCopy = Utilities.copyObject(vertexOne);
            delete vertexOneCopy.datasets;
            assert.deepEqual(response[0], vertexOneCopy);
        });
    });

    it('call to findVerticesByImportId() from invalid storage should fail', async () => {
        try {
            await myInvalidGraphStorage.findVerticesByImportId(vertexOne.datasets[0]);
        } catch (error) {
            assert.isTrue(error.toString().indexOf('Not connected to graph database') >= 0);
        }
    });

    // TODO enable this test when DL2 importer is in place
    it.skip('test virtualGraph', async () => {
        // precondition
        const responseVertexOne = await myGraphStorage.addVertex(vertexOne);
        const responseVertexTwo = await myGraphStorage.addVertex(vertexTwo);
        const responseEdgeOne = await myGraphStorage.addEdge(edgeOne);

        assert.equal(responseVertexOne._key, vertexOne._key);
        assert.equal(responseVertexTwo._key, vertexTwo._key);
        assert.equal(responseEdgeOne._key, edgeOne._key);

        const path = await myGraphStorage.findTraversalPath(vertexOne, 1000);

        function sortByKey(a, b) {
            if (a._key < b._key) {
                return 1;
            }
            if (a._key > b._key) {
                return -1;
            }
            return 0;
        }

        const objectVertices = [vertexOne, vertexTwo];
        const objectEdges = [edgeOne];
        assert.deepEqual(
            GraphStorage.getEdgesFromVirtualGraph(path).sort(sortByKey),
            Utilities.copyObject(objectEdges).sort(sortByKey),
        );
        assert.deepEqual(
            GraphStorage.getVerticesFromVirtualGraph(path).sort(sortByKey),
            Utilities.copyObject(objectVertices).sort(sortByKey),
        );
    });

    after('drop myGraphStorage db', async () => {
        if (selectedDatabase.provider === 'arangodb') {
            systemDb = new Database();
            systemDb.useBasicAuth(selectedDatabase.username, selectedDatabase.password);
            await systemDb.dropDatabase(myDatabaseName);
        } else {
            throw Error('Not implemented database provider.');
        }
    });

    it('call to findTrail from storage, expect three vertices', async () => {
        const responseVertexOne = await myGraphStorage.addVertex(vertexOne);
        const responseVertexTwo = await myGraphStorage.addVertex(vertexTwo);
        const responseVertexThree = await myGraphStorage.addVertex(vertexThree);
        const responseEdgeOne = await myGraphStorage.addEdge(edgeOne);
        const responseEdgeTwo = await myGraphStorage.addEdge(edgeTwo);

        assert.equal(responseVertexOne._key, vertexOne._key);
        assert.equal(responseVertexTwo._key, vertexTwo._key);
        assert.equal(responseVertexThree._key, vertexThree._key);
        assert.equal(responseEdgeOne._key, edgeOne._key);
        assert.equal(responseEdgeTwo._key, edgeTwo._key);

        const result = await myGraphStorage.findTrail({
            identifierKeys: vertexThree._key, depth: 1, connectionTypes: [],
        });
        assert.equal(result.length, 3);
        const keyArray = [vertexOne._key, vertexTwo._key, vertexThree._key].sort();
        const resultKeyArray = result.map(element => element.rootObject._key).sort();
        keyArray.forEach((element, index) => {
            assert.equal(element, resultKeyArray[index]);
        });
    });
});
