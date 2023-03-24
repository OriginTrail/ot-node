import { assertionMetadata } from 'assertion-tools';
import {
    OPERATION_ID_STATUS,
    OPERATION_REQUEST_STATUS,
    OPERATION_STATUS,
} from '../constants/constants.js';

class OperationService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.operationIdService = ctx.operationIdService;
        this.commandExecutor = ctx.commandExecutor;
        this.validationModuleManager = ctx.validationModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    getOperationName() {
        return this.operationName;
    }

    getNetworkProtocols() {
        return this.networkProtocols;
    }

    async getOperationStatus(operationId) {
        return this.repositoryModuleManager.getOperationStatus(
            this.getOperationName(),
            operationId,
        );
    }

    async getResponsesStatuses(responseStatus, errorMessage, operationId, keyword) {
        const self = this;
        let responses = 0;
        await this.operationMutex.runExclusive(async () => {
            await self.repositoryModuleManager.createOperationResponseRecord(
                responseStatus,
                this.operationName,
                operationId,
                keyword,
                errorMessage,
            );
            responses = await self.repositoryModuleManager.getOperationResponsesStatuses(
                this.operationName,
                operationId,
            );
        });

        const keywordsStatuses = {};
        responses.forEach((response) => {
            if (!keywordsStatuses[response.keyword])
                keywordsStatuses[response.keyword] = { failedNumber: 0, completedNumber: 0 };

            if (response.status === OPERATION_REQUEST_STATUS.FAILED) {
                keywordsStatuses[response.keyword].failedNumber += 1;
            } else {
                keywordsStatuses[response.keyword].completedNumber += 1;
            }
        });

        return keywordsStatuses;
    }

    async markOperationAsCompleted(operationId, responseData, endStatuses) {
        this.logger.info(`Finalizing ${this.operationName} for operationId: ${operationId}`);

        await this.repositoryModuleManager.updateOperationStatus(
            this.operationName,
            operationId,
            OPERATION_STATUS.COMPLETED,
        );

        await this.operationIdService.cacheOperationIdData(operationId, responseData);

        for (const status of endStatuses) {
            // eslint-disable-next-line no-await-in-loop
            await this.operationIdService.updateOperationIdStatus(operationId, status);
        }
    }

    async markOperationAsFailed(operationId, message) {
        this.logger.info(`${this.operationName} for operationId: ${operationId} failed.`);

        await this.repositoryModuleManager.updateOperationStatus(
            this.operationName,
            operationId,
            OPERATION_STATUS.FAILED,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.FAILED,
            message,
            this.errorType,
        );
    }

    async scheduleOperationForLeftoverNodes(commandData, leftoverNodes) {
        await this.commandExecutor.add({
            name: `${this.operationName}ScheduleMessagesCommand`,
            delay: 0,
            data: { ...commandData, leftoverNodes },
            transactional: false,
        });
    }

    logResponsesSummary(completedNumber, failedNumber) {
        this.logger.info(
            `Total number of responses: ${
                failedNumber + completedNumber
            }, failed: ${failedNumber}, completed: ${completedNumber}`,
        );
    }

    async validateAssertion(assertionId, blockchain, assertion) {
        this.logger.info(`Validating assertionId: ${assertionId}`);

        const calculatedAssertionId = this.validationModuleManager.calculateRoot(assertion);

        if (assertionId !== calculatedAssertionId) {
            throw Error(
                `Invalid assertion id. Received value: ${assertionId}, calculated: ${calculatedAssertionId}`,
            );
        }

        // validate size
        const blockchainAssertionSize = await this.blockchainModuleManager.getAssertionSize(
            blockchain,
            assertionId,
        );
        const assertionSize = assertionMetadata.getAssertionSizeInBytes(assertion);
        if (blockchainAssertionSize !== assertionSize) {
            throw Error(
                `Invalid assertion size, value read from blockchain: ${blockchainAssertionSize}, calculated: ${assertionSize}`,
            );
        }
        // validate triples number
        const blockchainTriplesNumber =
            await this.blockchainModuleManager.getAssertionTriplesNumber(blockchain, assertionId);
        const triplesNumber = assertionMetadata.getAssertionTriplesNumber(assertion);
        if (blockchainTriplesNumber !== triplesNumber) {
            throw Error(
                `Invalid triples number, value read from blockchain: ${blockchainTriplesNumber}, calculated: ${triplesNumber}`,
            );
        }
        // validate chunk size
        const blockchainChunksNumber = await this.blockchainModuleManager.getAssertionChunksNumber(
            blockchain,
            assertionId,
        );
        const chunksNumber = assertionMetadata.getAssertionChunksNumber(assertion);
        if (blockchainChunksNumber !== chunksNumber) {
            throw Error(
                `Invalid chunks number, value read from blockchain: ${blockchainChunksNumber}, calculated size: ${chunksNumber}`,
            );
        }
        this.logger.info(`Assertion integrity validated!`);
    }
}

export default OperationService;
