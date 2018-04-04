const { describe, it } = require('mocha');
const { assert } = require('chai');

const Graph = require('../../modules/graph');

describe('graph module ', () => {
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
});

