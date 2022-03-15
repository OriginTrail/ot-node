const {
    describe,
    it,
    before,
    after,
} = require('mocha');
const {
    assert,
    expect,
} = require('chai');
const Sparql = require('../../external/sparqlquery-service');
const Logger = require('../../modules/logger/logger');

const config = { url: 'http://localhost:9999/blazegraph/namespace/kb/sparql' };

let sparqlService = null;
let logger = null;
describe('Sparql module', () => {
    before('Initialize Logger', async () => {
        logger = new Logger('trace', false);
    });
    before('Init Sparql Module', async () => {
        assert.hasAllKeys(config, ['url']);
        assert.isNotNull(config.url);
        assert.isNotEmpty(config.url);
        sparqlService = new Sparql(config);
        await sparqlService.initialize(logger);
    });
    it('Execute HealthCheck', async () => {
        const a = await sparqlService.healthCheck();
        expect(a)
            .to
            .equal(true);
    });
});
