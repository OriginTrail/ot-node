import { describe, it, before, beforeEach, afterEach, after } from 'mocha';
import { expect, assert } from 'chai';
import { readFile } from 'fs/promises';
import { calculateRoot } from 'assertion-tools';
import ValidationModuleManager from '../../../../src/modules/validation/validation-module-manager.js';
import Logger from '../../../../src/logger/logger.js';

let validationManager;

const config = JSON.parse(await readFile('./test/unit/modules/validation/config.json', 'utf-8'));
const assertion = [
    {
        '@context': 'https://schema.org',
        '@id': 'https://tesla.modelX/2321',
        '@type': 'Car',
        name: 'Tesla Model X',
        brand: {
            '@type': 'Brand',
            name: 'Tesla',
        },
        model: 'Model X',
        manufacturer: {
            '@type': 'Organization',
            name: 'Tesla, Inc.',
        },
        fuelType: 'Electric',
    },
];
const hashFunctionId = 1;

describe('Validation module manager', async () => {
    beforeEach('initialize validation module manage', async () => {
        validationManager = new ValidationModuleManager({
            config,
            logger: new Logger(),
        });

        expect(await validationManager.initialize()).to.be.true;
    });

    it('validates module name', async () => {
        const moduleName = await validationManager.getName();

        expect(moduleName).to.equal('validation');
    });

    it('validate calculation of root hash are matched', async () => {
        const expectedRootHash = calculateRoot(assertion);
        const calculatedRootHash = validationManager.calculateRoot(assertion);

        assert(expect(calculatedRootHash).to.exist);
        expect(calculatedRootHash).to.equal(expectedRootHash);
    });

    it('validate merkle proof hash', async () => {
        const calculatedMerkleHash = validationManager.getMerkleProof(assertion, 0);

        assert(expect(calculatedMerkleHash).to.exist);
        expect(calculatedMerkleHash).to.be.instanceof(Object);
        expect(calculatedMerkleHash).to.haveOwnProperty('leaf').and.to.be.a('string');
        expect(calculatedMerkleHash).to.haveOwnProperty('proof').and.to.be.a('array');
    });

    it('validate getting function name', async () => {
        const getFnHashName = validationManager.getHashFunctionName(hashFunctionId);

        assert(expect(getFnHashName).to.exist);
        expect(getFnHashName).to.equal('sha256');
    });

    it('validate successful calling function name', async () => {
        const keyword =
            '0xB0D4afd8879eD9F52b28595d31B441D079B2Ca0768e44dc71bf509adfccbea9df949f253afa56796a3a926203f90a1e4914247d3';
        const callFunction = await validationManager.callHashFunction(hashFunctionId, keyword);

        assert(expect(callFunction).to.exist);
        expect(callFunction).to.be.a('string');
        expect(callFunction).to.equal(
            '0x5fe7425e0d956e2cafeac276c3ee8e70f377b2bd14790bc6d4777c3e7ba63b46',
        );
    });
});
