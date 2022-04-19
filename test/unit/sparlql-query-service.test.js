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
const fs = require('fs');



let sparqlService = null;
let logger = null;
chai.use(require('chai-as-promised'));

describe('Sparql module', () => {
    before('Initialize Logger', async () => {
        logger = new Logger('trace', false);
    });
    before('Init Sparql Module', async () => {
        const configFile = JSON.parse(fs.readFileSync('.origintrail_noderc.tests'));
        let config = configFile.graphDatabase;
        assert.isNotNull(config.sparqlEndpoint);
        assert.isNotEmpty(config.sparqlEndpoint);
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

    it('Check FindAssertionsByKeyword Errorhandling', async () => {
        await expect(sparqlService.findAssertionsByKeyword('abc', { limit: 'aaaa' }, false))
            .to
            .be
            .rejectedWith(Error);

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
    });

    it('Check FindAssertionsByKeyword functionality', async () => {
        // This can also be mocked if necessary
        const test = await sparqlService.findAssertionsByKeyword('pub', {
            limit: 5,
            prefix: true,
        }, true);
        // eslint-disable-next-line no-unused-expressions
        expect(test)
            .to
            .be
            .not
            .null;

        const testTwo = await sparqlService.findAssertionsByKeyword('pub', {
            limit: 5,
            prefix: false,
        }, true);
        // eslint-disable-next-line no-unused-expressions
        expect(testTwo)
            .to
            .be
            .not
            .null;
    })
        .timeout(600000);

    it('Check createFilterParameter', async () => {
        expect(sparqlService.createFilterParameter('', ''))
            .to
            .equal('');

        expect(sparqlService.createFilterParameter('\'', ''))
            .to
            .equal('');

        expect(sparqlService.createFilterParameter('\'', sparqlService.filtertype.KEYWORD))
            .to
            .equal('FILTER (lcase(?keyword) = \'\\\'\')');

        expect(sparqlService.createFilterParameter('abcd', sparqlService.filtertype.KEYWORD))
            .to
            .equal('FILTER (lcase(?keyword) = \'abcd\')');

        expect(sparqlService.createFilterParameter('abcd', sparqlService.filtertype.KEYWORDPREFIX))
            .to
            .equal('FILTER contains(lcase(?keyword),\'abcd\')');

        expect(sparqlService.createFilterParameter('abcd', sparqlService.filtertype.TYPES))
            .to
            .equal('FILTER (?type IN (abcd))');

        expect(sparqlService.createFilterParameter('abcd', sparqlService.filtertype.ISSUERS))
            .to
            .equal('FILTER (?issuer IN (abcd))');
    });
    it('Check FindAssetsByKeyword functionality', async () => {
        // This can also be mocked if necessary
        const test = await sparqlService.findAssetsByKeyword('pub', {
            limit: 5,
            prefix: true,
            issuers: '<did:dkg:99999>',
            types: '<did:dkg:33333>',
        }, true);
        // eslint-disable-next-line no-unused-expressions
        expect(test)
            .to
            .be
            .not
            .null;
    })
        .timeout(600000);
    it('Check resolve functionality', async () => {
        // This can also be mocked if necessary
        const test = await sparqlService.resolve('0e62550721611b96321c7459e7790498240431025e46fce9cd99f2ea9763ffb0');
        // eslint-disable-next-line no-unused-expressions
        expect(test)
            .to
            .be
            .not
            .null;
    })
        .timeout(600000);
    it('Check insert functionality', async () => {
        // This can also be mocked if necessary
        const test = await sparqlService.insert('<did:dkg:90e62550721611b96321c7459e7790498240431025e46fce9cd99f2ea9763ff11> schema:hasBlockchain "polygon::mainnet" ', 'did:dkg:90e62550721611b96321c7459e7790498240431025e46fce9cd99f2ea9763ff11');
        // eslint-disable-next-line no-unused-expressions
        expect(test)
            .to
            .be
            .not
            .null;
    })
        .timeout(600000);
});
