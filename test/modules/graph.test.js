const { describe, before, it } = require('mocha');
const { assert, expect } = require('chai');

const Graph = require('../../modules/graph');

describe('graph module ', () => {
    it('BFS empty graph', () => {
        const test_raw_graph = {
        };
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
        assert.equal(traversal.length, 4);
        assert.deepEqual(traversal, [
            {
                identifiers: {
                    uid: 1111,
                },
                outbound: [{ to: 2 }, { to: 4 }],
            },
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
        assert.equal(traversal.length, 3);
    });
});

