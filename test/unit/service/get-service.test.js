import { beforeEach, afterEach, describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { OPERATION_REQUEST_STATUS } from '../../../src/constants/constants.js';
import RepositoryModuleManagerMock from '../mock/repository-module-manager-mock.js';
import ValidationModuleManagerMock from '../mock/validation-module-manager-mock.js';
import BlockchainModuleManagerMock from '../mock/blockchain-module-manager-mock.js';
import OperationIdServiceMock from '../mock/operation-id-service-mock.js';
import CommandExecutorMock from '../mock/command-executor-mock.js';
import GetService from '../../../src/service/get-service.js';
import Logger from '../../../src/logger/logger.js';

let getService;
let loggerDebugSpy;
let loggerTraceSpy;
let loggerInfoSpy;
let consoleSpy;

describe('Get service test', async () => {
    beforeEach(() => {
        // probably operation id service mock should return some random string?
        // not sure how to mock command executor? create real one maybe/probably
        // with existing mock repository module manager
        const repositoryModuleManagerMock = new RepositoryModuleManagerMock();

        getService = new GetService({
            repositoryModuleManager: repositoryModuleManagerMock,
            operationIdService: new OperationIdServiceMock({
                repositoryModuleManager: repositoryModuleManagerMock,
            }),
            commandExecutor: new CommandExecutorMock(),
            validationModuleManager: new ValidationModuleManagerMock(),
            blockchainModuleManager: new BlockchainModuleManagerMock(),
            logger: new Logger(),
        });

        loggerDebugSpy = sinon.spy(getService.logger, 'debug');
        loggerTraceSpy = sinon.spy(getService.logger, 'trace');
        loggerInfoSpy = sinon.spy(getService.logger, 'info');
        consoleSpy = sinon.spy(console, 'log');

        console.log();
    });

    afterEach(() => {
        loggerDebugSpy.restore();
        loggerTraceSpy.restore();
        loggerInfoSpy.restore();
        consoleSpy.restore();
    });

    it('Completed get completes with low ACK ask', async () => {
        await getService.processResponse(
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
            {
                nquads: '<http://example.org/#spiderman> <http://www.perceive.net/schemas/relationship/enemyOf> <http://example.org/#green-goblin> <http://example.org/graphs/spiderman> .',
            },
        );

        const returnedResponses = getService.repositoryModuleManager.getAllResponseStatuses();

        expect(returnedResponses.length).to.be.equal(2);

        expect(
            loggerInfoSpy.calledWith(
                'Finalizing get for operationId: 5195d01a-b437-4aae-b388-a77b9fa715f1',
            ),
        ).to.be.true;

        expect(consoleSpy.calledWith('Caching data for:', '5195d01a-b437-4aae-b388-a77b9fa715f1'))
            .to.be.true;

        expect(
            consoleSpy.calledWith(
                'Caching data:',
                '<http://example.org/#spiderman> <http://www.perceive.net/schemas/relationship/enemyOf> <http://example.org/#green-goblin> <http://example.org/graphs/spiderman> .',
            ),
        ).to.be.true;

        expect(
            returnedResponses[returnedResponses.length - 1].status ===
                OPERATION_REQUEST_STATUS.COMPLETED,
        ).to.be.true;
    });

    it('Completed get leads to scheduling operation for leftover nodes and status stays same', async () => {
        await getService.processResponse(
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

        const returnedResponses = getService.repositoryModuleManager.getAllResponseStatuses();

        expect(returnedResponses.length).to.be.equal(2);

        expect(consoleSpy.calledWith('Operation id:', '5195d01a-b437-4aae-b388-a77b9fa715f1')).to.be
            .true;
        expect(consoleSpy.calledWith('Leftover nodes:', [1, 2, 3, 4])).to.be.true;

        expect(
            returnedResponses[returnedResponses.length - 1].status ===
                OPERATION_REQUEST_STATUS.COMPLETED,
        ).to.be.true;
    });
    /*
    it('Failed publish fails with low ACK ask', async () => {
        await publishService.processResponse(
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

        const returnedResponses = publishService.repositoryModuleManager.getAllResponseStatuses();

        expect(returnedResponses.length).to.be.equal(2);

        expect(
            loggerInfoSpy.calledWith(
                'publish for operationId: 5195d01a-b437-4aae-b388-a77b9fa715f1 failed.',
            ),
        ).to.be.true;

        expect(consoleSpy.calledWith('Not replicated to enough nodes!'));

        expect(
            returnedResponses[returnedResponses.length - 1].status ===
                OPERATION_REQUEST_STATUS.FAILED,
        ).to.be.true;
    });

    it('Successful publish leads to scheduling operation for leftover nodes', async () => {
        await publishService.processResponse(
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

        const returnedResponses = publishService.repositoryModuleManager.getAllResponseStatuses();

        expect(returnedResponses.length).to.be.equal(2);

        expect(consoleSpy.calledWith('Operation id:', '5195d01a-b437-4aae-b388-a77b9fa715f1')).to.be
            .true;
        expect(consoleSpy.calledWith('Leftover nodes:', [1, 2, 3, 4])).to.be.true;

        expect(
            returnedResponses[returnedResponses.length - 1].status ===
                OPERATION_REQUEST_STATUS.COMPLETED,
        ).to.be.true;
    }); */
});
