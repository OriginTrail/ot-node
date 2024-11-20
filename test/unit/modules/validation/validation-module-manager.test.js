import { describe, it, beforeEach } from 'mocha';
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
const invalidValues = [null, undefined];
const hashFunctionId = 1;
const keyword =
    '0xB0D4afd8879eD9F52b28595d31B441D079B2Ca0768e44dc71bf509adfccbea9df949f253afa56796a3a926203f90a1e4914247d3';

describe.only('Validation module manager', async () => {
    beforeEach('initialize validation module manage', async () => {
        validationManager = new ValidationModuleManager({
            config,
            logger: new Logger(),
        });

        validationManager.initialized = true;
        expect(await validationManager.initialize()).to.be.true;
    });

    it('validates module name is as expected', async () => {
        const moduleName = await validationManager.getName();

        expect(moduleName).to.equal('validation');
    });

    it('validate successful root hash calculation, expect to be matched', async () => {
        const expectedRootHash = calculateRoot(assertion);
        const calculatedRootHash = validationManager.calculateRoot(assertion);

        assert(expect(calculatedRootHash).to.exist);
        expect(calculatedRootHash).to.equal(expectedRootHash);
    });

    it('root hash cannot be calculated without initialization', async () => {
        validationManager.initialized = false;

        try {
            validationManager.calculateRoot(assertion);
        } catch (error) {
            expect(error.message).to.equal('Validation module is not initialized.');
        }
    });

    it('root hash calculation failed when assertion is null or undefined', async () => {
        invalidValues.forEach((value) => {
            expect(() => validationManager.calculateRoot(value)).to.throw(
                Error,
                'Calculation failed: Assertion cannot be null or undefined.',
            );
        });
    });

    it('successful getting merkle proof hash', async () => {
        const calculatedMerkleHash = await validationManager.getMerkleProof(assertion, 0);

        assert(expect(calculatedMerkleHash).to.exist);
        expect(calculatedMerkleHash).to.be.instanceof(Object);
        expect(calculatedMerkleHash).to.haveOwnProperty('leaf').and.to.be.a('string');
        expect(calculatedMerkleHash).to.haveOwnProperty('proof').and.to.be.a('array');
    });

    it('merkle prof hash cannot be calculated without initialization', async () => {
        validationManager.initialized = false;

        try {
            validationManager.getMerkleProof(assertion, 0);
        } catch (error) {
            expect(error.message).to.equal('Validation module is not initialized.');
        }
    });

    it('failed merkle prof hash calculation when assertion is null or undefined', async () => {
        invalidValues.forEach((value) => {
            expect(() => validationManager.getMerkleProof(value, 0)).to.throw(
                Error,
                'Get merkle proof failed: Assertion cannot be null or undefined.',
            );
        });
    });

    it('validate getting function name', async () => {
        const getFnHashName = validationManager.getHashFunctionName(hashFunctionId);

        assert(expect(getFnHashName).to.exist);
        expect(getFnHashName).to.equal('sha256');
    });

    it('failed getting function name without initialization', async () => {
        validationManager.initialized = false;

        try {
            validationManager.getHashFunctionName(hashFunctionId);
        } catch (error) {
            expect(error.message).to.equal('Validation module is not initialized.');
        }
    });

    it('validate successful calling function name', async () => {
        const callFunction = await validationManager.callHashFunction(hashFunctionId, keyword);

        assert(expect(callFunction).to.exist);
        expect(callFunction).to.be.a('string');
        expect(callFunction).to.equal(
            '0x5fe7425e0d956e2cafeac276c3ee8e70f377b2bd14790bc6d4777c3e7ba63b46',
        );
    });

    it('unsuccessful calling function name without initialization', async () => {
        validationManager.initialized = false;

        try {
            await validationManager.callHashFunction(hashFunctionId, keyword);
        } catch (error) {
            expect(error.message).to.equal('Validation module is not initialized.');
        }
    });

    it('failed function name initialization when function id is null or undefined', async () => {
        async function testInvalidValues() {
            for (const value of invalidValues) {
                try {
                    // eslint-disable-next-line no-await-in-loop
                    await validationManager.getMerkleProof(value, 0);
                } catch (error) {
                    expect(error.message).to.equal(
                        'Get merkle proof failed: Assertion cannot be null or undefined.',
                    );
                }
            }
        }

        await testInvalidValues();
    });

    it('failed function name initialization when data is null or undefined', async () => {
        async function testInvalidValues() {
            for (const value of invalidValues) {
                try {
                    // eslint-disable-next-line no-await-in-loop
                    await validationManager.callHashFunction(value, 0);
                } catch (error) {
                    expect(error.message).to.equal(
                        'Calling hash fn failed: Values cannot be null or undefined.',
                    );
                }
            }
        }

        await testInvalidValues();
    });
});
