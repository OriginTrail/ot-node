import { beforeEach, afterEach, describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { OPERATION_REQUEST_STATUS } from '../../../src/constants/constants.js';
import RepositoryModuleManagerMock from '../mock/repository-module-manager-mock.js';
import ValidationModuleManagerMock from '../mock/validation-module-manager-mock.js';
import BlockchainModuleManagerMock from '../mock/blockchain-module-manager-mock.js';
import OperationIdServiceMock from '../mock/operation-id-service-mock.js';
import CommandExecutorMock from '../mock/command-executor-mock.js';
import UpdateService from '../../../src/service/update-service.js';
import Logger from '../../../src/logger/logger.js';

let updateService;
let consoleSpy;

describe('Update service test', async () => {
    beforeEach(() => {
        const repositoryModuleManagerMock = new RepositoryModuleManagerMock();

        updateService = new UpdateService({
            repositoryModuleManager: repositoryModuleManagerMock,
            operationIdService: new OperationIdServiceMock({
                repositoryModuleManager: repositoryModuleManagerMock,
            }),
            commandExecutor: new CommandExecutorMock(),
            validationModuleManager: new ValidationModuleManagerMock(),
            blockchainModuleManager: new BlockchainModuleManagerMock(),
            logger: new Logger(),
        });

        consoleSpy = sinon.spy(console, 'log');
    });

    afterEach(() => {
        consoleSpy.restore();
    });

    it('Completed update completes with low ACK ask', async () => {
        await updateService.processResponse(
            {
                data: {
                    operationId: '5195d01a-b437-4aae-b388-a77b9fa715f1',
                    numberOfFoundNodes: 1,
                    leftoverNodes: [],
                    keyword: 'origintrail',
                    batchSize: 10,
                    minAckResponses: 1,
                },
            },
            OPERATION_REQUEST_STATUS.COMPLETED,
            {},
        );

        const returnedResponses = updateService.repositoryModuleManager.getAllResponseStatuses();

        expect(returnedResponses.length).to.be.equal(2);

        expect(consoleSpy.calledWith('Caching data for:', '5195d01a-b437-4aae-b388-a77b9fa715f1'))
            .to.be.true;

        expect(
            returnedResponses[returnedResponses.length - 1].status ===
                OPERATION_REQUEST_STATUS.COMPLETED,
        ).to.be.true;
    });

    it('Completed update fails with high ACK ask', async () => {
        await updateService.processResponse(
            {
                data: {
                    operationId: '5195d01a-b437-4aae-b388-a77b9fa715f1',
                    numberOfFoundNodes: 1,
                    leftoverNodes: [],
                    keyword: 'origintrail',
                    batchSize: 10,
                    minAckResponses: 12,
                },
            },
            OPERATION_REQUEST_STATUS.COMPLETED,
            {},
        );

        const returnedResponses = updateService.repositoryModuleManager.getAllResponseStatuses();

        expect(returnedResponses.length).to.be.equal(2);

        expect(consoleSpy.calledWith('Not replicated to enough nodes!'));

        expect(
            returnedResponses[returnedResponses.length - 1].status ===
                OPERATION_REQUEST_STATUS.FAILED,
        ).to.be.true;
    });

    it('Failed update fails with low ACK ask', async () => {
        await updateService.processResponse(
            {
                data: {
                    operationId: '5195d01a-b437-4aae-b388-a77b9fa715f1',
                    numberOfFoundNodes: 1,
                    leftoverNodes: [],
                    keyword: 'origintrail',
                    batchSize: 10,
                    minAckResponses: 1,
                },
            },
            OPERATION_REQUEST_STATUS.FAILED,
            {},
        );

        const returnedResponses = updateService.repositoryModuleManager.getAllResponseStatuses();

        expect(returnedResponses.length).to.be.equal(2);

        expect(consoleSpy.calledWith('Not replicated to enough nodes!'));

        expect(
            returnedResponses[returnedResponses.length - 1].status ===
                OPERATION_REQUEST_STATUS.FAILED,
        ).to.be.true;
    });

    it('Completed update leads to scheduling operation for leftover nodes and status stays same', async () => {
        await updateService.processResponse(
            {
                data: {
                    operationId: '5195d01a-b437-4aae-b388-a77b9fa715f1',
                    numberOfFoundNodes: 1,
                    leftoverNodes: [1, 2, 3, 4],
                    keyword: 'origintrail',
                    batchSize: 10,
                    minAckResponses: 12,
                },
            },
            OPERATION_REQUEST_STATUS.COMPLETED,
            {},
        );

        const returnedResponses = updateService.repositoryModuleManager.getAllResponseStatuses();

        expect(returnedResponses.length).to.be.equal(2);

        expect(consoleSpy.calledWith('Operation id:', '5195d01a-b437-4aae-b388-a77b9fa715f1')).to.be
            .true;
        expect(consoleSpy.calledWith('Leftover nodes:', [1, 2, 3, 4])).to.be.true;

        expect(
            returnedResponses[returnedResponses.length - 1].status ===
                OPERATION_REQUEST_STATUS.COMPLETED,
        ).to.be.true;
    });
});
