const { Mutex } = require('async-mutex');
const { formatAssertion } = require('assertion-tools');
const OperationService = require('./operation-service');
const {
    OPERATION_ID_STATUS,
    PUBLISH_REQUEST_STATUS,
    PUBLISH_STATUS,
    NETWORK_PROTOCOLS,
    ERROR_TYPE,
    SCHEMA_CONTEXT,
} = require('../constants/constants');

class PublishService extends OperationService {
    constructor(ctx) {
        super(ctx);
        this.ualService = ctx.ualService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.validationModuleManager = ctx.validationModuleManager;
        this.dataService = ctx.dataService;

        this.operationName = 'publish';
        this.networkProtocol = NETWORK_PROTOCOLS.STORE;
        this.operationRequestStatus = PUBLISH_REQUEST_STATUS;
        this.operationStatus = PUBLISH_STATUS;
        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_ERROR;
        this.completedStatuses = [
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_REPLICATE_END,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_END,
            OPERATION_ID_STATUS.COMPLETED,
        ];
        this.operationRepositoryMutex = new Mutex();
    }

    async processResponse(command, responseStatus, responseData, errorMessage = null) {
        const {
            operationId,
            ual,
            assertionId,
            numberOfFoundNodes,
            leftoverNodes,
            numberOfNodesInBatch,
            keyword,
            keywords,
        } = command.data;

        const keywordsStatuses = await this.getResponsesStatuses(
            responseStatus,
            errorMessage,
            operationId,
            keyword,
            keywords,
        );

        const { completedNumber, failedNumber } = keywordsStatuses[keyword];
        const numberOfResponses = completedNumber + failedNumber;
        this.logger.debug(
            `Processing ${this.networkProtocol} response for operationId: ${operationId}, keyword: ${keyword}. Total number of nodes: ${numberOfFoundNodes}, number of nodes in batch: ${numberOfNodesInBatch} number of leftover nodes: ${leftoverNodes.length}, number of responses: ${numberOfResponses}, Completed: ${completedNumber}, Failed: ${failedNumber}`,
        );

        if (completedNumber === this.config.minimumReplicationFactor) {
            let allCompleted = true;
            for (const key in keywordsStatuses) {
                if (keywordsStatuses[key].completedNumber < this.config.minimumReplicationFactor) {
                    allCompleted = false;
                    break;
                }
            }
            if (allCompleted) {
                await this.markOperationAsCompleted(operationId, {}, this.completedStatuses);
                this.logResponsesSummary(completedNumber, failedNumber);
            }
        } else if (
            completedNumber < this.config.minimumReplicationFactor &&
            (numberOfFoundNodes === numberOfResponses ||
                numberOfResponses % numberOfNodesInBatch === 0)
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
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
        this.logger.info(`Getting assertion for ual: ${ual}`);

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

        await this.tripleStoreModuleManager.insertIndex(
            assertion.join('\n'),
            assertionId,
            indexNquads.join('\n'),
            keyword,
            assetNquads.join('\n'),
        );

        this.logger.info(
            `Index for asset: ${ual}, keyword: ${keyword}, with assertion id ${assertionId} has been successfully inserted!`,
        );
    }

    async localStoreAssertion(assertionId, operationId) {
        const { assertion } = await this.operationIdService.getCachedOperationIdData(operationId);

        this.logger.info(`Inserting assertion with id: ${assertionId} in triple store.`);

        await this.tripleStoreModuleManager.insertAssertion(assertion.join('\n'), assertionId);

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

        await this.tripleStoreModuleManager.insertAsset(
            assertion.join('\n'),
            assertionId,
            assetNquads.join('\n'),
            ual,
        );

        this.logger.info(
            `Asset with assertion id: ${assertionId}, ual: ${ual} has been successfully inserted!`,
        );
    }
}

module.exports = PublishService;
