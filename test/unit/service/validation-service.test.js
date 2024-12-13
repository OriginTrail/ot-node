import { beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import ValidationModuleManagerMock from '../mock/validation-module-manager-mock.js';
import BlockchainModuleManagerMock from '../mock/blockchain-module-manager-mock.js';
import ValidationService from '../../../src/service/validation-service.js';
import Logger from '../../../src/logger/logger.js';

let validationService;

describe('Validation service test', async () => {
    beforeEach(() => {
        validationService = new ValidationService({
            validationModuleManager: new ValidationModuleManagerMock(),
            blockchainModuleManager: new BlockchainModuleManagerMock(),
            logger: new Logger(),
            config: {
                maximumAssertionSizeInKb: 2500,
            },
        });
    });

    it('Validates assertion correctly', async () => {
        let errorThrown = false;
        try {
            await validationService.validateAssertion(
                '0xde58cc52a5ce3a04ae7a05a13176226447ac02489252e4d37a72cbe0aea46b42',
                'hardhat',
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
            );
        } catch (error) {
            errorThrown = true;
        }
        expect(errorThrown).to.be.false;
    });

    it('Tries to validate assertion but fails due to assertion size mismatch', async () => {
        // todo after corrective component is implemented, update this logic
        // let errorThrown = false;
        // try {
        //     await validationService.validateAssertion(
        //         '0xde58cc52a5ce3a04ae7a05a13176226447ac02489252e4d37a72cbe0aea46b42',
        //         'hardhat',
        //         {
        //             '@context': 'https://schema.org',
        //             '@id': 'https://tesla.modelX/2321',
        //             '@type': 'Car',
        //             name: 'Tesla Model X',
        //         },
        //     );
        // } catch (error) {
        //     errorThrown = true;
        // }
        // expect(errorThrown).to.be.true;
    });

    it('Tries to validate assertion but fails due to triple number mismatch', async () => {
        validationService.blockchainModuleManager.getAssertionTriplesNumber = (
            blockchain,
            assertionMerkleRoot,
        ) => 5; // Will lead to mismatch with assertion calculated value

        let errorThrown = false;
        try {
            await validationService.validateAssertion(
                '0xde58cc52a5ce3a04ae7a05a13176226447ac02489252e4d37a72cbe0aea46b42',
                'hardhat',
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
            );
        } catch (error) {
            errorThrown = true;
        }
        expect(errorThrown).to.be.true;
    });

    it('Tries to validate assertion but fails due to chunk number mismatch', async () => {
        validationService.blockchainModuleManager.getAssertionChunksNumber = (
            blockchain,
            assertionMerkleRoot,
        ) => 5; // Will lead to mismatch with assertion chunk number calculated value

        let errorThrown = false;
        try {
            await validationService.validateAssertion(
                '0xde58cc52a5ce3a04ae7a05a13176226447ac02489252e4d37a72cbe0aea46b42',
                'hardhat',
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
            );
        } catch (error) {
            errorThrown = true;
        }
        expect(errorThrown).to.be.true;
    });

    it('Tries to validate assertion but fails due to validation manager returning wrong assertion id', async () => {
        // todo after corrective component is implemented, update this logic
        // Will lead to mismatch with passed assertion id
        // validationService.validationModuleManager.calculateRoot = (assertion) => '';
        //
        // let errorThrown = false;
        // try {
        //     await validationService.validateAssertion(
        //         '0xde58cc52a5ce3a04ae7a05a13176226447ac02489252e4d37a72cbe0aea46b42',
        //         'hardhat',
        //         {
        //             '@context': 'https://schema.org',
        //             '@id': 'https://tesla.modelX/2321',
        //             '@type': 'Car',
        //             name: 'Tesla Model X',
        //             brand: {
        //                 '@type': 'Brand',
        //                 name: 'Tesla',
        //             },
        //             model: 'Model X',
        //             manufacturer: {
        //                 '@type': 'Organization',
        //                 name: 'Tesla, Inc.',
        //             },
        //             fuelType: 'Electric',
        //         },
        //     );
        // } catch (error) {
        //     errorThrown = true;
        // }
        // expect(errorThrown).to.be.true;
    });
});
