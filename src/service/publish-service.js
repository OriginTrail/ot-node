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
    TRIPLE_STORE_REPOSITORIES,
} from '../constants/constants.js';

class PublishService extends OperationService {
    constructor(ctx) {
        super(ctx);
        this.ualService = ctx.ualService;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;

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
        const {
            operationId,
            numberOfFoundNodes,
            leftoverNodes,
            keyword,
            batchSize,
            minAckResponses,
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
            `Processing ${
                this.operationName
            } response for operationId: ${operationId}, keyword: ${keyword}. Total number of nodes: ${numberOfFoundNodes}, number of nodes in batch: ${Math.min(
                numberOfFoundNodes,
                batchSize,
            )} number of leftover nodes: ${
                leftoverNodes.length
            }, number of responses: ${numberOfResponses}, Completed: ${completedNumber}, Failed: ${failedNumber}, minimum replication factor: ${minAckResponses}`,
        );
        if (responseData.errorMessage) {
            this.logger.trace(
                `Error message for operation id: ${operationId}, keyword: ${keyword} : ${responseData.errorMessage}`,
            );
        }

        if (
            responseStatus === OPERATION_REQUEST_STATUS.COMPLETED &&
            completedNumber === minAckResponses
        ) {
            let allCompleted = true;
            for (const key in keywordsStatuses) {
                if (keywordsStatuses[key].completedNumber < minAckResponses) {
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
            completedNumber < minAckResponses &&
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

    async getLatestAssertionId(blockchain, contract, tokenId) {
        return this.blockchainModuleManager.getLatestAssertionId(blockchain, contract, tokenId);
    }

    async localStoreAsset(
        assertionId,
        blockchain,
        contract,
        tokenId,
        operationId,
        agreementStartTime,
        agreementEndTime,
        keyword,
    ) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.info(
            `Inserting asset with assertion id: ${assertionId}, ual: ${ual} in triple store.`,
        );

        // get current assertion, store current assertion in historical repository, add triple UAL -> assertionId
        const assertionIds = await this.tripleStoreModuleManager.getAssetAssertionIds(
            TRIPLE_STORE_REPOSITORIES.CURRENT,
            ual,
        );
        if (assertionIds?.length) {
            const currentAssertionId = assertionIds[0];
            let nquads = await this.tripleStoreModuleManager.getAssertion(
                TRIPLE_STORE_REPOSITORIES.CURRENT,
                currentAssertionId,
            );
            nquads = await this.dataService.toNQuads(nquads, 'application/n-quads');

            const historicalAssetNquads = await formatAssertion({
                '@context': SCHEMA_CONTEXT,
                '@id': ual,
                blockchain,
                contract,
                tokenId,
                assertion: { '@id': `assertion:${assertionId}` },
            });
            await Promise.all([
                this.tripleStoreModuleManager.insertAsset(
                    TRIPLE_STORE_REPOSITORIES.CURRENT,
                    ual,
                    historicalAssetNquads.join('\n'),
                    false,
                ),
                this.tripleStoreModuleManager.insertAssertion(
                    TRIPLE_STORE_REPOSITORIES.CURRENT,
                    assertionId,
                    nquads,
                ),
            ]);

            const isAssertionIdShared = await this.tripleStoreModuleManager.isAssertionIdShared(
                TRIPLE_STORE_REPOSITORIES.CURRENT,
                currentAssertionId,
            );
            if (!isAssertionIdShared) {
                // delete old assertion from current repository
                this.tripleStoreModuleManager.deleteAssertion(
                    TRIPLE_STORE_REPOSITORIES.CURRENT,
                    assertionId,
                );
            }
        }

        // store new assertion in current repository, update triple UAL -> assertionId
        const currentAssetNquads = await formatAssertion({
            '@context': SCHEMA_CONTEXT,
            '@id': ual,
            blockchain,
            contract,
            tokenId,
            assertion: { '@id': `assertion:${assertionId}` },
            agreementStartTime,
            agreementEndTime,
            keyword,
        });
        const { assertion } = await this.operationIdService.getCachedOperationIdData(operationId);

        await Promise.all([
            this.tripleStoreModuleManager.insertAsset(
                TRIPLE_STORE_REPOSITORIES.CURRENT,
                ual,
                currentAssetNquads.join('\n'),
            ),
            this.tripleStoreModuleManager.insertAssertion(
                TRIPLE_STORE_REPOSITORIES.CURRENT,
                assertionId,
                assertion.join('\n'),
            ),
        ]);

        this.logger.info(
            `Asset with assertion id: ${assertionId}, ual: ${ual} has been successfully inserted!`,
        );
    }
}

export default PublishService;
