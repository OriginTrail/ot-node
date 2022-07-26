const OperationService = require('./operation-service');
const {
    OPERATION_ID_STATUS,
    PUBLISH_REQUEST_STATUS,
    PUBLISH_STATUS,
    NETWORK_PROTOCOLS,
    ERROR_TYPE,
} = require('../constants/constants');

class PublishService extends OperationService {
    constructor(ctx) {
        super(ctx);
        this.ualService = ctx.ualService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
        this.validationModuleManager = ctx.validationModuleManager;

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
                await this.markOperationAsCompleted(
                    operationId,
                    { ual, assertionId },
                    this.completedStatuses,
                );
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

        const operationIdData = await this.operationIdService.getCachedOperationIdData(operationId);

        const assertion = operationIdData.data.concat(operationIdData.metadata);

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
        const { metadata, data } = await this.operationIdService.getCachedOperationIdData(
            operationId,
        );
        const assertionGraphName = `${ual}/${assertionId}`;
        const dataGraphName = `${ual}/${assertionId}/data`;
        const metadatadataGraphName = `${ual}/${assertionId}/metadata`;

        const assertionNquads = [
            `<${assertionGraphName}> <http://schema.org/metadata> <${metadatadataGraphName}> .`,
            `<${assertionGraphName}> <http://schema.org/data> <${dataGraphName}> .`,
        ];

        this.logger.info(`Inserting assertion with ual:${ual} in database.`);

        const insertPromises = [
            this.tripleStoreModuleManager.insert(metadata.join('\n'), metadatadataGraphName),
            this.tripleStoreModuleManager.insert(data.join('\n'), dataGraphName),
            this.tripleStoreModuleManager.insert(assertionNquads.join('\n'), assertionGraphName),
        ];

        await Promise.all(insertPromises);

        this.logger.info(`Assertion ${ual} has been successfully inserted!`);
    }
}

module.exports = PublishService;
