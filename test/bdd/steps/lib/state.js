/**
 * Object state is used in tests as a global variable accessible using this.state
 * This object looks like this:
 */

// eslint-disable-next-line no-unused-vars
const state = {
    // this is local blockchain object look at test/bdd/steps/lib/local-blockchain.js
    localBlockchain: {},
    // array of nodes
    nodes: {
        0: {
            client: {},
            fork: {},
        },
        1: {
            client: {},
            fork: {},
        },
    },
    bootstraps: [],
    lastPublishData: {
        nodeId: 1,
        operationId: '',
        keywords: ['', ''],
        assertion: {},
        result: {},
    },
    lastResolveData: {
        nodeId: 1,
        operationId: '',
        assertionIds: ['', ''],
        result: {},
    },
    scenarionLogDir: '',
};
