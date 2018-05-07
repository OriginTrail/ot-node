const {
    describe, it, afterEach, beforeEach, before, after,
} = require('mocha');
const { assert } = require('chai');
const sinon = require('sinon');
const Graph = require('../../modules/Graph');
const GraphInstance = require('../../modules/GraphInstance');
var models = require('../../models');
const Encryption = require('../../modules/Encryption');
const SystemStorage = require('../../modules/Database/SystemStorage');
const Storage = require('../../modules/Storage');
const Utilities = require('../../modules/Utilities');
// eslint-disable-next-line  prefer-destructuring
const Database = require('arangojs').Database;
const GraphStorage = require('../../modules/Database/GraphStorage');
const GSInstance = require('../../modules/GraphStorageInstance');
const databaseData = require('./test_data/database-data.js');
const deasync = require('deasync-promise');

const myUserName = 'otuser';
const myPassword = 'otpass';
const myDatabaseName = 'test_graph';


let selectedDatabase;
let systemDb;

describe('graph module ', () => {
    before('loadSelectedDatabaseInfo() and init GraphStorage', async () => {
        Storage.models = deasync(models.sequelize.sync()).models;
        selectedDatabase = await Utilities.loadSelectedDatabaseInfo();
        assert.hasAllKeys(selectedDatabase, ['id', 'database_system', 'username', 'password',
            'host', 'port', 'max_path_length', 'database']);

        systemDb = new Database();
        systemDb.useBasicAuth('root', 'root');
        await systemDb.createDatabase(
            myDatabaseName,
            [{ username: myUserName, passwd: myPassword, active: true }],
        );
        selectedDatabase.database = myDatabaseName;

        GSInstance.db = new GraphStorage(selectedDatabase);
        GraphInstance.g = new Graph();
    });

    after('drop myDatabaseName db', async () => {
        systemDb = new Database();
        systemDb.useBasicAuth('root', 'root');
        await systemDb.dropDatabase(myDatabaseName);
    });

    // TODO reenable with fix of .skipped tests
    // beforeEach('create stubs', async () => {
    //     this.encrytionMock = sinon.sandbox.mock(Encryption);
    // });

    // TODO reenable with fix of .skipped tests
    // afterEach('restore stubs', async () => {
    //     this.encrytionMock.restore();
    // });
    it('BFS empty graph', () => {
        const test_raw_graph = {};
        const traversal = Graph.bfs(test_raw_graph, 1111, false);
        assert.equal(traversal.length, 0);
    });
    it('BFS null graph', () => {
        const test_raw_graph = null;
        const traversal = Graph.bfs(test_raw_graph, 1111, false);
        assert.equal(traversal.length, 0);
    });
    it('BFS connected graph test', () => {
        const test_raw_graph = {
            1: {
                identifiers: {
                    uid: 1111,
                },
                outbound: [{ to: 2 }, { to: 4 }],
            },
            2: {
                identifiers: {
                    uid: 2222,
                },
            },
            3: {
                identifiers: {
                    uid: 3333,
                },
            },
            4: {
                identifiers: {
                    uid: 4444,
                },
                outbound: [{ to: 3 }],
            },
        };
        const traversal = Graph.bfs(test_raw_graph, 1111, false);
        assert.equal(traversal.length, 7);
        assert.deepEqual(traversal, [
            {
                identifiers: {
                    uid: 1111,
                },
                outbound: [{ to: 2 }, { to: 4 }],
            },
            { to: 2 },
            { to: 4 },
            {
                identifiers: {
                    uid: 2222,
                },
            },
            {
                identifiers: {
                    uid: 4444,
                },
                outbound: [{ to: 3 }],
            },
            { to: 3 },
            {
                identifiers: {
                    uid: 3333,
                },
            },
        ]);
    });
    it('BFS not connected graph test', () => {
        const test_raw_graph = {
            1: {
                identifiers: {
                    uid: 1111,
                },
                outbound: [{ to: 2 }, { to: 4 }],
            },
            2: {
                identifiers: {
                    uid: 2222,
                },
            },
            3: {
                identifiers: {
                    uid: 3333,
                },
            },
            4: {
                identifiers: {
                    uid: 4444,
                },
            },
        };
        const traversal = Graph.bfs(test_raw_graph, 1111, false);
        assert.equal(traversal.length, 5);
    });
    it('BFS connected graph restricted test I', () => {
        const test_raw_graph = {
            1: {
                identifiers: {
                    uid: 1111,
                },
                outbound: [{ to: 2 }, { to: 4 }],
            },
            2: {
                identifiers: {
                    uid: 2222,
                },
            },
            3: {
                identifiers: {
                    uid: 3333,
                },
                vertex_type: 'BATCH',
            },
            4: {
                identifiers: {
                    uid: 4444,
                },
                outbound: [{ to: 3, edge_type: 'TRANSACTION_CONNECTION' }],
            },
            5: {
                identifiers: {
                    uid: 5555,
                },
            },
        };
        const traversal = Graph.bfs(test_raw_graph, 1111, true);
        assert.equal(traversal.length, 5);
        assert.deepEqual(traversal, [
            {
                identifiers: {
                    uid: 1111,
                },
                outbound: [{ to: 2 }, { to: 4 }],
            },
            { to: 2 },
            { to: 4 },
            {
                identifiers: {
                    uid: 2222,
                },
            },
            {
                identifiers: {
                    uid: 4444,
                },
                outbound: [{ to: 3, edge_type: 'TRANSACTION_CONNECTION' }],
            },
        ]);
    });
    it('BFS connected graph restricted test II', () => {
        const test_raw_graph = {
            1: {
                identifiers: {
                    uid: 1111,
                },
                outbound: [{ to: 2 }, { to: 4 }],
            },
            2: {
                identifiers: {
                    uid: 2222,
                },
            },
            3: {
                identifiers: {
                    uid: 3333,
                },
                vertex_type: 'SOME_VERTEX',
                outbound: [{ to: 5 }],
            },
            4: {
                identifiers: {
                    uid: 4444,
                },
                outbound: [{ to: 3, edge_type: 'SOME_EDGE' }],
            },
            5: {
                identifiers: {
                    uid: 5555,
                },
            },
        };
        const traversal = Graph.bfs(test_raw_graph, 1111, true);
        assert.equal(traversal.length, 9);
        assert.deepEqual(traversal, [
            {
                identifiers: {
                    uid: 1111,
                },
                outbound: [{ to: 2 }, { to: 4 }],
            },
            { to: 2 },
            { to: 4 },
            {
                identifiers: {
                    uid: 2222,
                },
            },
            {
                identifiers: {
                    uid: 4444,
                },
                outbound: [{ to: 3, edge_type: 'SOME_EDGE' }],
            },
            { to: 3, edge_type: 'SOME_EDGE' },
            {
                identifiers: {
                    uid: 3333,
                },
                vertex_type: 'SOME_VERTEX',
                outbound: [{ to: 5 }],
            },
            { to: 5 },
            { identifiers: { uid: 5555 } },
        ]);
    });
    // TODO
    it.skip('Encrypt vertices, key not found test', () => {
        const SystemStorageStub = sinon.spy(() => sinon.createStubInstance(SystemStorage));
        const sysdb = new SystemStorageStub();
        sysdb.connect.returns(Promise.resolve());
        sysdb.runSystemQuery.returns(Promise.resolve([]));
        sysdb.runSystemUpdate.returns(Promise.resolve());

        const graph = new Graph(null, sysdb);

        const keyPair = Encryption.generateKeyPair();
        this.encrytionMock = sinon.stub(Encryption, 'generateKeyPair').returns(keyPair);

        const vertexData = 1;
        const encryptedVertices = deasync(graph.encryptVertices('wallet_1', 'kademila_1', [{ data: vertexData }]));
        assert.isNotNull(encryptedVertices);

        sinon.assert.calledOnce(sysdb.runSystemUpdate);

        const encryptedVertex = encryptedVertices.vertices[0];
        assert.isNotNull(encryptedVertex);

        const encryptedData = Encryption.encryptRawData(vertexData, keyPair.privateKey);
        assert.isNotNull(encryptedData);
        assert.equal(encryptedData, encryptedVertex.data);
    });

    it('decryptVertices() of encryptVertices() should give back original data', async () => {
        const vertexData = 1;

        const encryptedVertices = await Graph.encryptVertices('wallet_1', 'kademlia_1', [{ data: vertexData }]);
        assert.isNotNull(encryptedVertices);
        const encryptedVertex = encryptedVertices.vertices[0];
        assert.isNotNull(encryptedVertex);

        // eslint-disable-next-line max-len
        const decryptedVertices = await Graph.decryptVertices(encryptedVertices.vertices, encryptedVertices.vertices[0].decryption_key);
        assert.isTrue(decryptedVertices[0].data === vertexData);
    });

    // TODO
    it.skip('Encrypt vertices, key found test', () => {
        const SystemStorageStub = sinon.spy(() => sinon.createStubInstance(SystemStorage));
        const sysdb = new SystemStorageStub();
        sysdb.connect.returns(Promise.resolve());

        const keyPair = Encryption.generateKeyPair();
        sysdb.runSystemQuery.returns(Promise.resolve([{
            data_private_key: keyPair.privateKey,
            data_public_key: keyPair.publicKey,
        }]));
        sysdb.runSystemUpdate.returns(Promise.resolve());

        const graph = new Graph(null, sysdb);
        this.encrytionMock = sinon.stub(Encryption, 'generateKeyPair').returns(keyPair);

        const vertexData = 1;
        const encryptedVertices = deasync(graph.encryptVertices('wallet_1', 'kademila_1', [{ data: vertexData }]));
        assert.isNotNull(encryptedVertices);

        sinon.assert.notCalled(sysdb.runSystemUpdate);

        const encryptedVertex = encryptedVertices.vertices[0];
        assert.isNotNull(encryptedVertex);

        const encryptedData = Encryption.encryptRawData(vertexData, keyPair.privateKey);
        assert.isNotNull(encryptedData);
        assert.equal(encryptedData, encryptedVertex.data);
    });
});
