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
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
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
        } = command.data;

        const keywordsStatuses = await this.getResponsesStatuses(
            responseStatus,
            errorMessage,
            operationId,
            keyword,
        );

        const { completedNumber, failedNumber } = keywordsStatuses[keyword];
        const numberOfResponses = completedNumber + failedNumber;
        this.logger.debug(
            `Processing ${this.networkProtocol} response for operationId: ${operationId}, keyword: ${keyword}. Total number of nodes: ${numberOfFoundNodes}, number of nodes in batch: ${numberOfNodesInBatch} number of leftover nodes: ${leftoverNodes.length}, number of responses: ${numberOfResponses}`,
        );

        if (completedNumber >= this.config.minimumReplicationFactor) {
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
            numberOfFoundNodes === numberOfResponses ||
            numberOfNodesInBatch === numberOfResponses
        ) {
            if (leftoverNodes.length === 0) {
                await this.markOperationAsFailed(operationId, 'Not replicated to enough nodes!');
                this.logResponsesSummary(completedNumber, failedNumber);
            } else {
                await this.scheduleOperationForLeftoverNodes(command.data, leftoverNodes);
            }
        }
    }

    async validateAssertion(ual, operationId) {
        this.logger.info(`Validating assertion with ual: ${ual}`);

        const assertion = await this.operationIdService.getCachedOperationIdData(operationId);

        /* // TODO only for testing purposes; disable before the release
        const assertionId = this.validationModuleManager.calculateRoot(assertion); */

        // TODO only for testing purposes; enable before the release
        const { blockchain, contract, tokenId } = this.ualService.resolveUAL(ual);
        const assertionId = await this.blockchainModuleManager.getLatestCommitHash(
            blockchain,
            contract,
            tokenId,
        );

        const calculatedAssertionId = this.validationModuleManager.calculateRoot(assertion);

        if (assertionId !== calculatedAssertionId) {
            throw Error(
                `Invalid root hash. Received value from blockchain: ${assertionId}, calculated: ${calculatedAssertionId}`,
            );
        }

        this.logger.info(`Assertion integrity validated!`);

        return assertionId;
    }

    async localStore(ual, assertionId, operationId) {
        const assertion = await this.operationIdService.getCachedOperationIdData(operationId);
        const { blockchain, contract, tokenId } = this.ualService.resolveUAL(ual);

        const assetsGraph = 'assets:graph';
        const assertionGraphName = `assertion:${assertionId}`;
        const assetNquads = await this.dataService.toNQuads({
            '@context': SCHEMA_CONTEXT,
            '@id': ual,
            blockchain,
            contract,
            tokenId,
            assertion: assertionId,
            latestAssertion: assertionId,
        });

        this.logger.info(`Inserting assertion with ual:${ual} in database.`);

        const insertPromises = [
            this.tripleStoreModuleManager.insert(assertion.join('\n'), assertionGraphName),
            this.tripleStoreModuleManager.insert(assetNquads.join('\n'), assetsGraph),
        ];

        await Promise.all(insertPromises);

        this.logger.info(`Assertion ${ual} has been successfully inserted!`);
    }
}

module.exports = PublishService;
