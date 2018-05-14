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
let myInvalidGraphStorage;
let myInvalidGraphConnection;

describe('GraphStorage module', () => {
    before('loadSelectedDatabaseInfo() and init myGraphStorage', async () => {
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
        expect(myGraphStorage).to.be.an.instanceof(GraphStorage);
    });

    it('connect() and identify()', async () => {
        myGraphStorageConnection = await myGraphStorage.connect();
        // TODO meaningful checks for connect()

        assert.equal(myGraphStorage.identify(), 'ArangoJS');
        assert.equal(myGraphStorage.db.identify(), 'ArangoJS');
    });

    it('Unable to connect to graph database scenario', async () => {
        myInvalidGraphStorage = new GraphStorage();
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

    it('attempt to save vertex in non existing Document Collection should fail', async () => {
        try {
            await myGraphStorage.addVertex(vertexOne);
        } catch (error) {
            assert.isTrue(error.toString().indexOf('ArangoError: collection not found: ot_vertices') >= 0);
        }
    });

    it('attempt to save edge in non existing Edge Collection should fail', async () => {
        try {
            await myGraphStorage.addEdge(edgeOne);
        } catch (error) {
            assert.isTrue(error.toString().indexOf('ArangoError: collection not found: ot_edges') >= 0);
        }
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


    it('adding 2nd vertex from invalid storage should fail', async () => {
        try {
            const result =
                await myInvalidGraphStorage.addVertex(vertexTwo);
        } catch (error) {
            assert.isTrue(error.toString().indexOf('Not connected to graph database') >= 0);
        }
    });

    it('.addEdge() should save edge in Edge Document Collection', () => {
        myGraphStorage.addEdge(edgeOne).then((response) => {
            assert.containsAllKeys(response, ['_id', '_key', '_rev']);
        });
    });

    it('findVerticesByImportId() ', async () => {
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

    after('drop myGraphStorage db', async () => {
        systemDb = new Database();
        systemDb.useBasicAuth('root', 'root');
        await systemDb.dropDatabase(myDatabaseName);
    });
});
