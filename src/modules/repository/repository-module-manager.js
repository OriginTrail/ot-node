import BaseModuleManager from '../base-module-manager.js';

class RepositoryModuleManager extends BaseModuleManager {
    getName() {
        return 'repository';
    }

    getRepository(repoName) {
        if (!this.initialized) {
            throw new Error('RepositoryModuleManager not initialized');
        }
        return this.getImplementation().module.getRepository(repoName);
    }

    async transaction(execFn) {
        if (this.initialized) {
            return this.getImplementation().module.transaction(execFn);
        }
    }

    async dropDatabase() {
        if (this.initialized) {
            return this.getImplementation().module.dropDatabase();
        }
    }

    async query(query, options = {}) {
        if (this.initialized) {
            return this.getImplementation().module.query(query, options);
        }
    }

    async destroyAllRecords(table, options = {}) {
        if (this.initialized) {
            return this.getImplementation().module.destroyAllRecords(table, options);
        }
    }

    async updateCommand(update, options = {}) {
        return this.getRepository('command').updateCommand(update, options);
    }

    async destroyCommand(name, options = {}) {
        return this.getRepository('command').destroyCommand(name, options);
    }

    async createCommand(command, options = {}) {
        return this.getRepository('command').createCommand(command, options);
    }

    async getCommandsWithStatus(statusArray, excludeNameArray = [], options = {}) {
        return this.getRepository('command').getCommandsWithStatus(
            statusArray,
            excludeNameArray,
            options,
        );
    }

    async getCommandWithId(id, options = {}) {
        return this.getRepository('command').getCommandWithId(id, options);
    }

    async removeCommands(ids, options = {}) {
        return this.getRepository('command').removeCommands(ids, options);
    }

    async findFinalizedCommands(timestamp, limit, options = {}) {
        return this.getRepository('command').findFinalizedCommands(timestamp, limit, options);
    }

    async findUnfinalizedCommandsByName(limit, options = {}) {
        return this.getRepository('command').findUnfinalizedCommandsByName(limit, options);
    }

    async createOperationIdRecord(handlerData, options = {}) {
        return this.getRepository('operation_id').createOperationIdRecord(handlerData, options);
    }

    async updateOperationIdRecord(data, operationId, options = {}) {
        return this.getRepository('operation_id').updateOperationIdRecord(
            data,
            operationId,
            options,
        );
    }

    async getOperationIdRecord(operationId, options = {}) {
        return this.getRepository('operation_id').getOperationIdRecord(operationId, options);
    }

    async removeOperationIdRecord(timeToBeDeleted, statuses, options = {}) {
        return this.getRepository('operation_id').removeOperationIdRecord(
            timeToBeDeleted,
            statuses,
            options,
        );
    }

    async updateMinAcksReached(operationId, minAcksReached, options = {}) {
        return this.getRepository('operation_id').updateMinAcksReached(
            operationId,
            minAcksReached,
            options,
        );
    }

    async createOperationRecord(operation, operationId, status, options = {}) {
        return this.getRepository('operation').createOperationRecord(
            operation,
            operationId,
            status,
            options,
        );
    }

    async removeOperationRecords(operation, ids, options = {}) {
        return this.getRepository('operation').removeOperationRecords(operation, ids, options);
    }

    async findProcessedOperations(operation, timestamp, limit, options = {}) {
        return this.getRepository('operation').findProcessedOperations(
            operation,
            timestamp,
            limit,
            options,
        );
    }

    async getOperationStatus(operation, operationId, options = {}) {
        return this.getRepository('operation').getOperationStatus(operation, operationId, options);
    }

    async updateOperationStatus(operation, operationId, status, options = {}) {
        return this.getRepository('operation').updateOperationStatus(
            operation,
            operationId,
            status,
            options,
        );
    }

    async createOperationResponseRecord(status, operation, operationId, errorMessage, options) {
        return this.getRepository('operation_response').createOperationResponseRecord(
            status,
            operation,
            operationId,
            errorMessage,
            options,
        );
    }

    async getOperationResponsesStatuses(operation, operationId, options = {}) {
        return this.getRepository('operation_response').getOperationResponsesStatuses(
            operation,
            operationId,
            options,
        );
    }

    async findProcessedOperationResponse(timestamp, limit, operation, options = {}) {
        return this.getRepository('operation_response').findProcessedOperationResponse(
            timestamp,
            limit,
            operation,
            options,
        );
    }

    async removeOperationResponse(ids, operation, options = {}) {
        return this.getRepository('operation_response').removeOperationResponse(
            ids,
            operation,
            options,
        );
    }

    async createManyPeerRecords(peers, options = {}) {
        return this.getRepository('shard').createManyPeerRecords(peers, options);
    }

    async removeShardingTablePeerRecords(blockchain, options = {}) {
        return this.getRepository('shard').removeShardingTablePeerRecords(blockchain, options);
    }

    async createPeerRecord(peerId, blockchain, ask, stake, lastSeen, sha256, options = {}) {
        return this.getRepository('shard').createPeerRecord(
            peerId,
            blockchain,
            ask,
            stake,
            lastSeen,
            sha256,
            options,
        );
    }

    async getPeerRecord(peerId, blockchain, options = {}) {
        return this.getRepository('shard').getPeerRecord(peerId, blockchain, options);
    }

    async getAllPeerRecords(blockchain, options = {}) {
        return this.getRepository('shard').getAllPeerRecords(blockchain, options);
    }

    async getPeerRecordsByIds(blockchain, peerIds, options = {}) {
        return this.getRepository('shard').getPeerRecordsByIds(blockchain, peerIds, options);
    }

    async getPeersCount(blockchain, options = {}) {
        return this.getRepository('shard').getPeersCount(blockchain, options);
    }

    async getPeersToDial(limit, dialFrequencyMillis, options = {}) {
        return this.getRepository('shard').getPeersToDial(limit, dialFrequencyMillis, options);
    }

    async removePeerRecord(blockchain, peerId, options = {}) {
        return this.getRepository('shard').removePeerRecord(blockchain, peerId, options);
    }

    async updatePeerRecordLastDialed(peerId, timestamp, options = {}) {
        return this.getRepository('shard').updatePeerRecordLastDialed(peerId, timestamp, options);
    }

    async updatePeerRecordLastSeenAndLastDialed(peerId, timestamp, options = {}) {
        return this.getRepository('shard').updatePeerRecordLastSeenAndLastDialed(
            peerId,
            timestamp,
            options,
        );
    }

    async updatePeerAsk(peerId, blockchainId, ask, options = {}) {
        return this.getRepository('shard').updatePeerAsk(peerId, blockchainId, ask, options);
    }

    async updatePeerStake(peerId, blockchainId, stake, options = {}) {
        return this.getRepository('shard').updatePeerStake(peerId, blockchainId, stake, options);
    }

    async getNeighbourhood(assertionId, r2, options = {}) {
        return this.getRepository('shard').getNeighbourhood(assertionId, r2, options);
    }

    async cleanShardingTable(blockchainId, options = {}) {
        return this.getRepository('shard').cleanShardingTable(blockchainId, options);
    }

    async isNodePartOfShard(blockchainId, peerId, options = {}) {
        return this.getRepository('shard').isNodePartOfShard(blockchainId, peerId, options);
    }

    async destroyEvents(ids, options = {}) {
        return this.getRepository('event').destroyEvents(ids, options);
    }

    async getUser(username, options = {}) {
        return this.getRepository('user').getUser(username, options);
    }

    async saveToken(tokenId, userId, tokenName, expiresAt, options = {}) {
        return this.getRepository('token').saveToken(
            tokenId,
            userId,
            tokenName,
            expiresAt,
            options,
        );
    }

    async isTokenRevoked(tokenId, options = {}) {
        return this.getRepository('token').isTokenRevoked(tokenId, options);
    }

    async getTokenAbilities(tokenId, options = {}) {
        return this.getRepository('token').getTokenAbilities(tokenId, options);
    }

    async insertBlockchainEvents(events, options = {}) {
        return this.getRepository('blockchain_event').insertBlockchainEvents(events, options);
    }

    async getAllUnprocessedBlockchainEvents(blockchain, eventNames, options = {}) {
        return this.getRepository('blockchain_event').getAllUnprocessedBlockchainEvents(
            blockchain,
            eventNames,
            options,
        );
    }

    async markAllBlockchainEventsAsProcessed(blockchain, options = {}) {
        return this.getRepository('blockchain_event').markAllBlockchainEventsAsProcessed(
            blockchain,
            options,
        );
    }

    async removeEvents(ids, options = {}) {
        return this.getRepository('blockchain_event').removeEvents(ids, options);
    }

    async removeContractEventsAfterBlock(
        blockchain,
        contract,
        contractAddress,
        blockNumber,
        transactionIndex,
        options = {},
    ) {
        return this.getRepository('blockchain_event').removeContractEventsAfterBlock(
            blockchain,
            contract,
            contractAddress,
            blockNumber,
            transactionIndex,
            options,
        );
    }

    async findProcessedEvents(timestamp, limit, options = {}) {
        return this.getRepository('blockchain_event').findProcessedEvents(
            timestamp,
            limit,
            options,
        );
    }

    async getLastCheckedBlock(blockchain, options = {}) {
        return this.getRepository('blockchain').getLastCheckedBlock(blockchain, options);
    }

    async updateLastCheckedBlock(blockchain, currentBlock, timestamp, options = {}) {
        return this.getRepository('blockchain').updateLastCheckedBlock(
            blockchain,
            currentBlock,
            timestamp,
            options,
        );
    }

    async addToParanetKaCount(paranetId, blockchainId, kaCount, options = {}) {
        return this.getRepository('paranet').addToParanetKaCount(
            paranetId,
            blockchainId,
            kaCount,
            options,
        );
    }

    async createParanetRecord(name, description, paranetId, blockchainId, options = {}) {
        this.getRepository('paranet').createParanetRecord(
            name,
            description,
            paranetId,
            blockchainId,
            options,
        );
    }

    async paranetExists(paranetId, blockchainId, options = {}) {
        return this.getRepository('paranet').paranetExists(paranetId, blockchainId, options);
    }

    async getParanet(paranetId, blockchainId, options = {}) {
        return this.getRepository('paranet').getParanet(paranetId, blockchainId, options);
    }

    async getParanetKnowledgeAssetsCount(paranetId, blockchainId, options = {}) {
        return this.getRepository('paranet').getParanetKnowledgeAssetsCount(
            paranetId,
            blockchainId,
            options,
        );
    }

    async createParanetAssetRecord(missedParanetAssset, options = {}) {
        return this.getRepository('paranet_asset').createParanetAssetRecord(
            missedParanetAssset,
            options,
        );
    }

    async getMissedParanetAssetRecords(blockchainId, options = {}) {
        return this.getRepository('missed_paranet_asset').getMissedParanetAssetRecords(
            blockchainId,
            options,
        );
    }

    async missedParanetAssetRecordExists(ual, options = {}) {
        return this.getRepository('paranet_asset').missedParanetAssetRecordExists(ual, options);
    }

    async incrementRetriesForUalAndParanetUal(ual, paranetUal, options = {}) {
        return this.getRepository('paranet_asset').incrementRetriesForUalAndParanetUal(
            ual,
            paranetUal,
            options,
        );
    }

    async removeMissedParanetAssetRecordsByUAL(ual, options = {}) {
        return this.getRepository('missed_paranet_asset').removeMissedParanetAssetRecordsByUAL(
            ual,
            options,
        );
    }

    async getMissedParanetAssetsRecordsWithRetryCount(
        paranetUal,
        retryCountLimit,
        retryDelayInMs,
        limit = null,
        options = {},
    ) {
        return this.getRepository('paranet_asset').getMissedParanetAssetsRecordsWithRetryCount(
            paranetUal,
            retryCountLimit,
            retryDelayInMs,
            limit,
            options,
        );
    }

    async getCountOfMissedAssetsOfParanet(paranetUal, options = {}) {
        return this.getRepository('paranet_asset').getCountOfMissedAssetsOfParanet(
            paranetUal,
            options,
        );
    }

    // TODO: remove
    // async getFilteredCountOfMissedAssetsOfParanet(
    //     ual,
    //     retryCountLimit,
    //     retryDelayInMs,
    //     options = {},
    // ) {
    //     return this.getRepository('paranet_asset').getFilteredCountOfMissedAssetsOfParanet(
    //         ual,
    //         retryCountLimit,
    //         retryDelayInMs,
    //         options,
    //     );
    // }

    async getParanetsBlockchains(options = {}) {
        return this.getRepository('paranet').getParanetsBlockchains(options);
    }

    async createParanetSyncedAssetRecord(
        blockchainId,
        ual,
        paranetUal,
        publicAssertionId,
        privateAssertionId,
        sender,
        transactionHash,
        dataSource,
        options = {},
    ) {
        return this.getRepository('paranet_asset').createParanetSyncedAssetRecord(
            blockchainId,
            ual,
            paranetUal,
            publicAssertionId,
            privateAssertionId,
            sender,
            transactionHash,
            dataSource,
            options,
        );
    }

    async getParanetSyncedAssetRecordByUAL(ual, options = {}) {
        return this.getRepository('paranet_asset').getParanetSyncedAssetRecordByUAL(ual, options);
    }

    async getParanetSyncedAssetRecordsCountByDataSource(paranetUal, options = {}) {
        return this.getRepository(
            'paranet_synced_asset',
        ).getParanetSyncedAssetRecordsCountByDataSource(paranetUal, options);
    }

    async paranetSyncedAssetRecordExists(ual, options = {}) {
        return this.getRepository('paranet_asset').paranetSyncedAssetRecordExists(ual, options);
    }

    async updateAssetToBeSynced(ual, asset, options = {}) {
        return this.getRepository('paranet_asset').updateAssetToBeSynced(ual, asset, options);
    }

    async incrementParanetKaCount(paranetId, blockchainId, options = {}) {
        return this.getRepository('paranet').incrementParanetKaCount(
            paranetId,
            blockchainId,
            options,
        );
    }

    async getFinalityAcksCount(ual, options = {}) {
        return this.getRepository('finality_status').getFinalityAcksCount(ual, options);
    }

    async saveFinalityAck(publishOperationId, ual, peerId, options = {}) {
        return this.getRepository('finality_status').saveFinalityAck(
            publishOperationId,
            ual,
            peerId,
            options,
        );
    }
}

export default RepositoryModuleManager;
