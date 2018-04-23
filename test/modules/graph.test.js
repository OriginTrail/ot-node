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
    it('Create virtual graph test', () => {
        const test_raw_graph = {
            graph_1: {
                vertices: [{
                    vertex_type: 'BUSINESS_LOCATION',
                    identifiers: {
                        BusinessLocationId: 'FARM_1',
                        uid: 'ot:WALLET_ID:otblid:FARM_1',
                    },
                    vertex_key: '2e0b1ba163be76138d51a0b8258e97d7',
                    _key: '2e0b1ba163be76138d51a0b8258e97d7',
                },
                {
                    vertex_type: 'PARTICIPANT',
                    identifiers: {
                        ParticipantId: 'PARTNER_ID',
                        uid: 'ot:WALLET_ID:otpartid:PARTNER_ID',
                    },
                    vertex_key: 'cd923bec4266a7f63b68722da254f205',
                    _key: 'cd923bec4266a7f63b68722da254f205',
                },
                ],
                edges: [
                    {
                        _key: '6eb743d84a605b2ab6be67a373b883d4',
                        edge_type: 'OWNED_BY',
                        _from: 'ot_vertices/2e0b1ba163be76138d51a0b8258e97d7',
                        _to: 'ot_vertices/cd923bec4266a7f63b68722da254f205',
                    },
                ],
            },
        };
        const traversal = Graph.convertToVirtualGraph(test_raw_graph);
        assert.deepEqual(traversal, {
            data: {
                '2e0b1ba163be76138d51a0b8258e97d7': {
                    identifiers: {
                        BusinessLocationId: 'FARM_1',
                        uid: 'ot:WALLET_ID:otblid:FARM_1',
                    },
                    key: '2e0b1ba163be76138d51a0b8258e97d7',
                    outbound: [
                        {
                            edge_type: 'OWNED_BY',
                            from: '2e0b1ba163be76138d51a0b8258e97d7',
                            key: '6eb743d84a605b2ab6be67a373b883d4',
                            to: 'cd923bec4266a7f63b68722da254f205',
                        },
                    ],
                    vertex_key: '2e0b1ba163be76138d51a0b8258e97d7',
                    vertex_type: 'BUSINESS_LOCATION',
                },
                cd923bec4266a7f63b68722da254f205: {
                    identifiers: {
                        ParticipantId: 'PARTNER_ID',
                        uid: 'ot:WALLET_ID:otpartid:PARTNER_ID',
                    },
                    key: 'cd923bec4266a7f63b68722da254f205',
                    outbound: [],
                    vertex_key: 'cd923bec4266a7f63b68722da254f205',
                    vertex_type: 'PARTICIPANT',
                },
            },
        });
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

    it('.findVertices() with empty query should fail', async () => {
        try {
            await GraphInstance.g.findVertices();
        } catch (error) {
            // Utilities.isEmptyObject() will complain
            assert.isTrue(error.toString().indexOf('Cannot convert undefined or null to object') >= 0);
        }
    });

    it('.findVertices() when still not connected to graph db should fail', async () => {
        const queryObject = {
            uid: '123',
            vertex_type: 'BATCH',
        };
        try {
            const result = await GraphInstance.g.findVertices(queryObject);
        } catch (error) {
            assert.isTrue(error.toString().indexOf('Error: Not connected to graph database') >= 0);
        }
    });

    it('.findVertices() on top of empty collection should find nothing', async () => {
        await GSInstance.db.connect();
        await GSInstance.db.createCollection('ot_vertices').then((response) => {
            assert.equal(response, 'Collection created');
        });
        const queryObject = {
            uid: '123',
            vertex_type: 'BATCH',
        };
        await GraphInstance.g.findVertices(queryObject).then((response) => {
            assert.isEmpty(response);
            assert.isTrue(typeof (response) === 'object');
        });
    });

    it('.findTraversalPath() with non valid startVertex should fail', async () => {
        // db alredy connected and ot_vertices exists
        const myStartVertex = {
            _id: undefined,
        };
        try {
            const response = await GraphInstance.g.findTraversalPath(myStartVertex);
            assert.isEmpty(response);
            assert.isTrue(typeof (response) === 'object');
        } catch (error) {
            console.log(error);
        }
    });

    it('.findTraversalPath() with non existing startVertex should fail', async () => {
        // db alredy connected and ot_vertices exists
        const myStartVertex = {
            _id: 0,
        };

        try {
            const response = await GraphInstance.g.findTraversalPath(myStartVertex);
        } catch (error) {
            assert.equal(error.code, 404);
        }
    });
});
