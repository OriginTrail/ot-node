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
    const edgeOne = databaseData.edges[0];
    const newImportValue = 2520345631;

    before('Init myGraphStorage', async () => {
        const config = rc(pjson.name, defaultConfig);
        selectedDatabase = config.database;
        selectedDatabase.database = myDatabaseName;
        Storage.models = deasync(models.sequelize.sync()).models;
        assert.hasAllKeys(selectedDatabase, ['provider', 'username', 'password',
            'host', 'port', 'max_path_length', 'database']);
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

    it('.addVertex() should save vertex in Document Collection', () => {
        myGraphStorage.addVertex(vertexOne).then((response) => {
            assert.containsAllKeys(response, ['_id', '_key', '_rev']);
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

        await myGraphStorage.findVerticesByImportId(vertexOne.imports[0]).then((response) => {
            assert.deepEqual(response[0].data, vertexOne.data);
            assert.deepEqual(response[0].vertex_type, vertexOne.vertex_type);
            assert.deepEqual(response[0].identifiers, vertexOne.identifiers);
            assert.deepEqual(response[0].vertex_key, vertexOne.vertex_key);
            assert.deepEqual(response[0].imports, vertexOne.imports);
            assert.deepEqual(response[0].data_provider, vertexOne.data_provider);
        });
    });

    it('call to findVerticesByImportId() from invalid storage should fail', async () => {
        try {
            const result = await myInvalidGraphStorage.findVerticesByImportId(vertexOne.imports[0]);
        } catch (error) {
            assert.isTrue(error.toString().indexOf('Not connected to graph database') >= 0);
        }
    });

    it('test virtualGraph', async () => {
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
            systemDb.useBasicAuth(process.env.DB_USERNAME, process.env.DB_PASSWORD);
            await systemDb.dropDatabase(myDatabaseName);
        } else {
            throw Error('Not implemented database provider.');
        }
    });
});
