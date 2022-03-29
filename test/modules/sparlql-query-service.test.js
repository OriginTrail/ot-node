const {
    describe,
    it,
    before,
    after,
} = require('mocha');
const chai = require('chai');

const {
    assert,
    expect,
} = chai;

const Sparql = require('../../external/sparqlquery-service');
const Logger = require('../../modules/logger/logger');

const config = { url: 'http://35.217.28.54:9999/blazegraph/namespace/kb/sparql' };

let sparqlService = null;
let logger = null;
chai.use(require('chai-as-promised'));

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
    it('Check for cleanup', async () => {
        // Success
        expect(sparqlService.cleanEscapeCharacter('keywordabc'))
            .to
            .equal('keywordabc');
        // Fail
        expect(sparqlService.cleanEscapeCharacter('keywordabc\''))
            .to
            .equal('keywordabc\\\'');
    });
    it('Check limit creation', async () => {
        // Success
        expect(() => sparqlService.createLimitQuery({ limit: 'abc' }))
            .to
            .throw(Error);

        expect(() => sparqlService.createLimitQuery({ limit: Math.random() }))
            .to
            .throw(Error);

        expect(sparqlService.createLimitQuery({}))
            .to
            .equal('');
        // var randomnumber = Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
        // eslint-disable-next-line no-bitwise
        const random = (Math.random() * (99999999 - 1 + 1)) << 0;
        const negativeRandom = random * -1;

        expect(sparqlService.createLimitQuery({ limit: random }))
            .to
            .equal(`LIMIT ${random}`);

        expect(() => sparqlService.createLimitQuery({ limit: negativeRandom }))
            .to
            .throw(Error);
    });

    it('Check FindAssertionsByKeyword', async () => {
        await expect(sparqlService.findAssertionsByKeyword('abc', { limit: 'aaaa' }, false))
            .to
            .be
            .rejectedWith(Error);

        const test = await sparqlService.findAssertionsByKeyword('pub', {
            limit: 5,
            prefix: true
        }, true);
        // eslint-disable-next-line no-unused-expressions
        expect(test)
            .to
            .be
            .not
            .null;

        await expect(sparqlService.findAssertionsByKeyword('abc', { limit: '90' }, 'test'))
            .to
            .be
            .rejectedWith(Error);

        await expect(sparqlService.findAssertionsByKeyword('abc', {
            limit: '90',
            prefix: 'test',
        }))
            .to
            .be
            .rejectedWith(Error);

        await expect(sparqlService.findAssertionsByKeyword('abc', { limit: '90' }))
            .to
            .be
            .rejectedWith(Error);
    })
        .timeout(100000);
});
