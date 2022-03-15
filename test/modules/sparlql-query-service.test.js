const {
    describe,
    it,
    before,
    after,
} = require('mocha');
const { assert } = require('chai');

describe('Sparql module ', () => {
    before('Init Sparql Module', async () => {
        const config = { url: 'http://localhost:9999/blazegraph/namespace/kb/sparql' };
        assert.hasAllKeys(config, ['url']);
    });
    it('test', async () => {
        const config = { url: 'http://localhost:9999/blazegraph/namespace/kb/sparql' };
    });
});
