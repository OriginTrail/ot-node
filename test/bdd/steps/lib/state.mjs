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
            fileService: {},
            configuration: {},
            nodeRpcUrl: ''
        },
        1: {
            client: {},
            fork: {},
            fileService: {},
            configuration: {},
            nodeRpcUrl: ''
        },
    },
    bootstraps: [],
    latestPublishData: {
        nodeId: 1,
        operationId: '',
        keywords: ['', ''],
        assertion: {},
        result: {},
    },
    latestGetData: {
        nodeId: 1,
        operationId: '',
        assertionIds: ['', ''],
        result: {},
    },
    latestUpdateData: {
        nodeId: 1,
        operationId: '',
        assertionIds: ['', ''],
        result: {},
    },
    scenarionLogDir: '',
};
