const OperationService = require('./operation-service');
const {
    HANDLER_ID_STATUS,
    PUBLISH_REQUEST_STATUS,
    PUBLISH_STATUS,
    NETWORK_PROTOCOLS,
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
        this.completedStatuses = [
            HANDLER_ID_STATUS.PUBLISH.PUBLISH_REPLICATE_END,
            HANDLER_ID_STATUS.PUBLISH.PUBLISH_END,
        ];
    }

    async processResponse(command, responseStatus, responseData, errorMessage = null) {
        const {
            handlerId,
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
            handlerId,
            keyword,
        );

        const { completedNumber, failedNumber } = keywordsStatuses[keyword];
        const numberOfResponses = completedNumber + failedNumber;
        this.logger.debug(
            `Processing ${this.networkProtocol} response for handlerId: ${handlerId}, keyword: ${keyword}. Total number of nodes: ${numberOfFoundNodes}, number of nodes in batch: ${numberOfNodesInBatch} number of leftover nodes: ${leftoverNodes.length}, number of responses: ${numberOfResponses}`,
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
                    handlerId,
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
                await this.markOperationAsFailed(handlerId, 'Not replicated to enough nodes!');
                this.logResponsesSummary(completedNumber, failedNumber);
            } else {
                await this.scheduleOperationForLeftoverNodes(command.data, leftoverNodes);
            }
        }
    }

    async validateAssertion(ual, handlerId) {
        this.logger.info(`Validating assertion with ual: ${ual}`);

        const handlerIdData = await this.handlerIdService.getCachedHandlerIdData(handlerId);

        const assertion = handlerIdData.data.concat(handlerIdData.metadata);

        const { blockchain, contract, tokenId } = this.ualService.resolveUAL(ual);
        const { issuer, assertionId } = await this.blockchainModuleManager.getAssetProofs(
            blockchain,
            contract,
            tokenId,
        );

        const calculatedAssertionId = this.validationModuleManager.calculateRootHash(assertion);

        if (assertionId !== calculatedAssertionId) {
            throw Error(
                `Invalid root hash. Received value from blockchain: ${assertionId}, calculated: ${calculatedAssertionId}`,
            );
        }
        this.logger.debug('Root hash matches');

        // const verify = await this.blockchainService.verify(assertionId, signature, walletInformation.publicKey);
        //
        // if (issuer !== issuer) {
        //     throw Error(`Invalid issuer. Received value from blockchin: ${issuer}, from metadata: ${issuer}`);
        // }
        this.logger.debug('Issuer is valid');

        this.logger.info(`Assertion with id: ${assertionId} passed all checks!`);

        return assertionId;
    }

    async localStore(ual, assertionId, handlerId) {
        const { metadata, data } = await this.handlerIdService.getCachedHandlerIdData(handlerId);
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
