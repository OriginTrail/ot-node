import { beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import { OPERATION_STATUS } from '../../../src/constants/constants.js';
import RepositoryModuleManagerMock from '../mock/repository-module-manager-mock.js';
import ValidationModuleManagerMock from '../mock/validation-module-manager-mock.js';
import BlockchainModuleManagerMock from '../mock/blockchain-module-manager-mock.js';
import OperationIdServiceMock from '../mock/operation-id-service-mock.js';
import CommandExecutorMock from '../mock/command-executor-mock.js';
import PublishService from '../../../src/service/publish-service.js';
import Logger from '../../../src/logger/logger.js';

let publishService;

describe('Publish service test', async () => {
    beforeEach(() => {
        // probably operation id service mock should return some random string?
        // not sure how to mock command executor? create real one maybe/probably
        // with existing mock repository module manager
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
    });

    it('Process response, returns *whatever* successfully', async () => {
        await publishService.processResponse(
            {
                data: {
                    operationId: '5195d01a-b437-4aae-b388-a77b9fa715f1',
                    numberOfFoundNodes: 10,
                    leftoverNodes: [],
                    keyword: 'origintrail',
                    batchSize: 10,
                    minAckResponses: 1,
                },
            },
            OPERATION_STATUS.COMPLETED,
            {},
        );

        console.log(publishService.repositoryModuleManager.getAllResponseStatuses());

        expect(publishService.repositoryModuleManager.getAllResponseStatuses().length).to.be.equal(
            2,
        );
    });
});
