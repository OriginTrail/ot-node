import { beforeEach, afterEach, describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { OPERATION_REQUEST_STATUS } from '../../../src/constants/constants.js';
import RepositoryModuleManagerMock from '../mock/repository-module-manager-mock.js';
import ValidationModuleManagerMock from '../mock/validation-module-manager-mock.js';
import BlockchainModuleManagerMock from '../mock/blockchain-module-manager-mock.js';
import OperationIdServiceMock from '../mock/operation-id-service-mock.js';
import CommandExecutorMock from '../mock/command-executor-mock.js';
import PublishService from '../../../src/service/publish-service.js';
import Logger from '../../../src/logger/logger.js';

let publishService;
let cacheOperationIdDataSpy;
let commandExecutorAddSpy;

describe('Operation service test', async () => {
    beforeEach(() => {
        const repositoryModuleManagerMock = new RepositoryModuleManagerMock();

        publishService = new PublishService({
            repositoryModuleManager: repositoryModuleManagerMock,
            operationIdService: new OperationIdServiceMock({
                repositoryModuleManager: repositoryModuleManagerMock,
            }),
            commandExecutor: new CommandExecutorMock(),
            validationModuleManager: new ValidationModuleManagerMock(),
            blockchainModuleManager: new BlockchainModuleManagerMock(),
            logger: new Logger(),
        });
        cacheOperationIdDataSpy = sinon.spy(
            publishService.operationIdService,
            'cacheOperationIdData',
        );
        commandExecutorAddSpy = sinon.spy(publishService.commandExecutor, 'add');
    });

    afterEach(() => {
        cacheOperationIdDataSpy.restore();
        commandExecutorAddSpy.restore();
    });

    it('Creates a response record and returns status for each keyword', async () => {
        await publishService.getResponsesStatuses(
            OPERATION_REQUEST_STATUS.FAILED,
            null,
            '5195d01a-b437-4aae-b388-a77b9fa715f1',
            'origintrail',
        );

        const returnedResponses = await publishService.getResponsesStatuses(
            OPERATION_REQUEST_STATUS.COMPLETED,
            null,
            '5195d01a-b437-4aae-b388-a77b9fa715f1',
            'origintrail',
        );

        // Do two calls to make sure the state has persisted after the first one

        expect(returnedResponses).to.deep.equal({
            origintrail: { failedNumber: 1, completedNumber: 1 },
        });
    });

    it('Validates assertion correctly', async () => {
        let errorThrown = false;
        try {
            await publishService.validateAssertion(
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
});
