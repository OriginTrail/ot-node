import { beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import RepositoryModuleManagerMock from '../mock/repository-module-manager-mock.js';
import ValidationModuleManagerMock from '../mock/validation-module-manager-mock.js';
import BlockchainModuleManagerMock from '../mock/blockchain-module-manager-mock.js';
import OperationIdServiceMock from '../mock/operation-id-service-mock.js';
import CommandExecutorMock from '../mock/command-executor-mock.js';
import PublishService from '../../../src/service/publish-service.js';

let publishService;

describe('Publish service test', async () => {
    beforeEach(() => {
        // probably operation id service mock should return some random string?
        // not sure how to mock command executor? create real one maybe/probably
        // with existing mock repository module manager
        publishService = new PublishService({
            repositoryModuleManager: new RepositoryModuleManagerMock(),
            operationIdService: new OperationIdServiceMock(),
            commandExecutor: new CommandExecutorMock(),
            validationModuleManager: new ValidationModuleManagerMock(),
            blockchainModuleManager: new BlockchainModuleManagerMock(),
        });
    });

    it('Process response, returns *whatever* successfully', async () => {
        await publishService.processResponse();
        expect(false).to.be.equal(false);
    });
});
