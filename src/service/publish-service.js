import { Mutex } from 'async-mutex';
import { formatAssertion } from 'assertion-tools';
import OperationService from './operation-service.js';

import {
    OPERATION_ID_STATUS,
    NETWORK_PROTOCOLS,
    ERROR_TYPE,
    SCHEMA_CONTEXT,
    OPERATIONS,
    OPERATION_REQUEST_STATUS,
} from '../constants/constants.js';

class PublishService extends OperationService {
    constructor(ctx) {
        super(ctx);
        this.ualService = ctx.ualService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
        this.validationModuleManager = ctx.validationModuleManager;

        this.operationName = OPERATIONS.PUBLISH;
        this.networkProtocols = NETWORK_PROTOCOLS.STORE;
        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_ERROR;
        this.completedStatuses = [
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_REPLICATE_END,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_END,
            OPERATION_ID_STATUS.COMPLETED,
        ];
        this.operationMutex = new Mutex();
    }

    async processResponse(command, responseStatus, responseData, errorMessage = null) {
        const { operationId, numberOfFoundNodes, leftoverNodes, keyword, batchSize } = command.data;

        const keywordsStatuses = await this.getResponsesStatuses(
            responseStatus,
            errorMessage,
            operationId,
            keyword,
        );

        const { completedNumber, failedNumber } = keywordsStatuses[keyword];
        const numberOfResponses = completedNumber + failedNumber;
        this.logger.debug(
            `Processing ${
                this.operationName
            } response for operationId: ${operationId}, keyword: ${keyword}. Total number of nodes: ${numberOfFoundNodes}, number of nodes in batch: ${batchSize} number of leftover nodes: ${
                leftoverNodes.length
            }, number of responses: ${numberOfResponses}, Completed: ${completedNumber}, Failed: ${failedNumber}, minimum replication factor: ${this.getMinimumAckResponses()}`,
        );

        if (
            responseStatus === OPERATION_REQUEST_STATUS.COMPLETED &&
            completedNumber === this.getMinimumAckResponses()
        ) {
            let allCompleted = true;
            for (const key in keywordsStatuses) {
                if (keywordsStatuses[key].completedNumber < this.getMinimumAckResponses()) {
                    allCompleted = false;
                    break;
                }
            }
            if (allCompleted) {
                await this.markOperationAsCompleted(operationId, {}, this.completedStatuses);
                this.logResponsesSummary(completedNumber, failedNumber);
                this.logger.info(
                    `Publish with operation id: ${operationId} with status: ${
                        this.completedStatuses[this.completedStatuses.length - 1]
                    }`,
                );
            }
        } else if (
            completedNumber < this.getMinimumAckResponses() &&
            (numberOfFoundNodes === numberOfResponses || numberOfResponses % batchSize === 0)
        ) {
            if (leftoverNodes.length === 0) {
                await this.markOperationAsFailed(operationId, 'Not replicated to enough nodes!');
                this.logResponsesSummary(completedNumber, failedNumber);
            } else {
                await this.scheduleOperationForLeftoverNodes(command.data, leftoverNodes);
            }
        }
    }

    async getAssertion(blockchain, contract, tokenId) {
        return this.blockchainModuleManager.getLatestCommitHash(blockchain, contract, tokenId);
    }

    async validateAssertion(assertionId, operationId) {
        this.logger.info(`Validating assertionId: ${assertionId}`);

        const { assertion } = await this.operationIdService.getCachedOperationIdData(operationId);
        const calculatedAssertionId = this.validationModuleManager.calculateRoot(assertion);

        if (assertionId !== calculatedAssertionId) {
            throw Error(
                `Invalid assertion id. Received value from blockchain: ${assertionId}, calculated: ${calculatedAssertionId}`,
            );
        }

        this.logger.info(`Assertion integrity validated!`);
    }

    async localStoreIndex(assertionId, blockchain, contract, tokenId, keyword, operationId) {
        const { assertion } = await this.operationIdService.getCachedOperationIdData(operationId);
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        // TODO get rank from blockchain
        const rank = 1;

        const indexNquads = await formatAssertion({
            '@context': SCHEMA_CONTEXT,
            '@id': ual,
            rank,
            metadata: { '@id': `assertion:${assertionId}` },
        });
        const assetNquads = await formatAssertion({
            '@context': SCHEMA_CONTEXT,
            '@id': ual,
            blockchain,
            contract,
            tokenId,
        });

        this.logger.info(
            `Inserting index for asset: ${ual}, keyword: ${keyword}, with assertion id: ${assertionId} in triple store.`,
        );

        await Promise.all(
            this.tripleStoreModuleManager.insertIndex(
                keyword,
                indexNquads.join('\n'),
                assetNquads.join('\n'),
            ),
            this.tripleStoreModuleManager.insertAssertion(assertionId, assertion.join('\n')),
        );

        this.logger.info(
            `Index for asset: ${ual}, keyword: ${keyword}, with assertion id ${assertionId} has been successfully inserted!`,
        );
    }

    async localStoreAssertion(assertionId, operationId) {
        const { assertion } = await this.operationIdService.getCachedOperationIdData(operationId);

        this.logger.info(`Inserting assertion with id: ${assertionId} in triple store.`);

        await this.tripleStoreModuleManager.insertAssertion(assertionId, assertion.join('\n'));

        this.logger.info(`Assertion with id ${assertionId} has been successfully inserted!`);
    }

    async localStoreAsset(assertionId, blockchain, contract, tokenId, operationId) {
        const { assertion } = await this.operationIdService.getCachedOperationIdData(operationId);
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        const assetNquads = await formatAssertion({
            '@context': SCHEMA_CONTEXT,
            '@id': ual,
            blockchain,
            contract,
            tokenId,
            assertion: { '@id': `assertion:${assertionId}` },
            latestAssertion: { '@id': `assertion:${assertionId}` },
        });

        this.logger.info(
            `Inserting asset with assertion id: ${assertionId}, ual: ${ual} in triple store.`,
        );

        await Promise.all([
            this.tripleStoreModuleManager.insertAsset(ual, assertionId, assetNquads.join('\n')),
            this.tripleStoreModuleManager.insertAssertion(assertionId, assertion.join('\n')),
        ]);

        this.logger.info(
            `Asset with assertion id: ${assertionId}, ual: ${ual} has been successfully inserted!`,
        );
    }
}

export default PublishService;
