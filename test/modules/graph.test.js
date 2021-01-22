const {
    describe, it, before, after,
} = require('mocha');
const { assert } = require('chai');
const sinon = require('sinon');
const rc = require('rc');
const Graph = require('../../modules/Graph');
const models = require('../../models');
const Encryption = require('../../modules/RSAEncryption');
const SystemStorage = require('../../modules/Database/SystemStorage');
const Storage = require('../../modules/Storage');

const defaultConfig = require('../../config/config.json').development;
const pjson = require('../../package.json');

describe('graph module ', () => {
    before('Init GraphStorage', async () => {
        const config = rc(pjson.name, defaultConfig);
        Storage.models = (await models.sequelize.sync()).models;
        assert.hasAllKeys(config.database, ['provider', 'username', 'password',
            'password_file_name', 'host', 'port', 'database', 'max_path_length', 'replication_info']);
        assert.hasAllKeys(config.database.replication_info, ['endpoint', 'username', 'password', 'port']);
    });

    after('drop myDatabaseName db', async () => {
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
                outbound: [{ to: 3, edge_type: 'EVENT_CONNECTION', transaction_flow: 'INPUT' }],
            },
            5: {
                identifiers: {
                    uid: 5555,
                },
            },
        };
        const traversal = Graph.bfs(test_raw_graph, 1111, true);
        assert.equal(traversal.length, 6);
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
                outbound: [
                    {
                        edge_type: 'EVENT_CONNECTION',
                        to: 3,
                        transaction_flow: 'INPUT',
                    },
                ],
            },
            {
                identifiers: {
                    uid: 3333,
                },
                vertex_type: 'BATCH',
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
    it.skip('Encrypt vertices, key not found test', async () => {
        const SystemStorageStub = sinon.spy(() => sinon.createStubInstance(SystemStorage));
        const sysdb = new SystemStorageStub();
        sysdb.connect.returns(Promise.resolve());
        sysdb.runSystemQuery.returns(Promise.resolve([]));
        sysdb.runSystemUpdate.returns(Promise.resolve());

        const graph = new Graph(null, sysdb);

        const keyPair = Encryption.generateKeyPair();
        this.encrytionMock = sinon.stub(Encryption, 'generateKeyPair').returns(keyPair);

        const vertexData = 1;
        const encryptedVertices =
            await Graph.encryptVertices([{ data: vertexData }], keyPair.privateKey);
        assert.isNotNull(encryptedVertices);

        sinon.assert.calledOnce(sysdb.runSystemUpdate);

        const encryptedVertex = encryptedVertices.vertices[0];
        assert.isNotNull(encryptedVertex);

        const encryptedData = Encryption.encryptRawData(vertexData, keyPair.privateKey);
        assert.isNotNull(encryptedData);
        assert.equal(encryptedData, encryptedVertex.data);
    });

    it('decryptVertices() of encryptVertices() should give back original data', async () => {
        const vertexData = {
            x: 1,
        };
        const keyPair = Encryption.generateKeyPair();
        const vertices = [{ data: vertexData }];
        Graph.encryptVertices(vertices, keyPair.privateKey);
        const encryptedVertices = vertices;
        assert.isNotNull(encryptedVertices);
        const encryptedVertex = encryptedVertices[0];
        assert.isNotNull(encryptedVertex);

        const decryptedVertices =
            await Graph.decryptVertices(encryptedVertices, keyPair.publicKey);
        assert.deepEqual(decryptedVertices[0].data, vertexData);
    });

    // TODO
    it.skip('Encrypt vertices, key found test', async () => {
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
        const encryptedVertices =
            await Graph.encryptVertices([{ data: vertexData }], keyPair.privateKey);
        assert.isNotNull(encryptedVertices);

        sinon.assert.notCalled(sysdb.runSystemUpdate);

        const encryptedVertex = encryptedVertices.vertices[0];
        assert.isNotNull(encryptedVertex);

        const encryptedData = Encryption.encryptRawData(vertexData, keyPair.privateKey);
        assert.isNotNull(encryptedData);
        assert.equal(encryptedData, encryptedVertex.data);
    });
});
