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

    async getCommandsWithStatus(statusArray, excludeNameArray = []) {
        return this.getRepository('command').getCommandsWithStatus(statusArray, excludeNameArray);
    }

    async getCommandWithId(id) {
        return this.getRepository('command').getCommandWithId(id);
    }

    async removeCommands(ids, options = {}) {
        return this.getRepository('command').removeCommands(ids, options);
    }

    async findFinalizedCommands(timestamp, limit) {
        return this.getRepository('command').findFinalizedCommands(timestamp, limit);
    }

    async findUnfinalizedCommandsByName(limit) {
        return this.getRepository('command').findUnfinalizedCommandsByName(limit);
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

    async getOperationIdRecord(operationId) {
        return this.getRepository('operation_id').getOperationIdRecord(operationId);
    }

    async removeOperationIdRecord(timeToBeDeleted, statuses, options = {}) {
        return this.getRepository('operation_id').removeOperationIdRecord(
            timeToBeDeleted,
            statuses,
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

    async findProcessedOperations(operation, timestamp, limit) {
        return this.getRepository('operation').findProcessedOperations(operation, timestamp, limit);
    }

    async getOperationStatus(operation, operationId) {
        return this.getRepository('operation').getOperationStatus(operation, operationId);
    }

    async updateOperationStatus(operation, operationId, status, options = {}) {
        return this.getRepository('operation').updateOperationStatus(
            operation,
            operationId,
            status,
            options,
        );
    }

    async createOperationResponseRecord(
        status,
        operation,
        operationId,
        keyword,
        errorMessage,
        options = {},
    ) {
        return this.getRepository('operation_response').createOperationResponseRecord(
            status,
            operation,
            operationId,
            keyword,
            errorMessage,
            options,
        );
    }

    async getOperationResponsesStatuses(operation, operationId) {
        return this.getRepository('operation_response').getOperationResponsesStatuses(
            operation,
            operationId,
        );
    }

    async findProcessedOperationResponse(timestamp, limit, operation) {
        return this.getRepository('operation_response').findProcessedOperationResponse(
            timestamp,
            limit,
            operation,
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

    async getPeerRecord(peerId, blockchain) {
        return this.getRepository('shard').getPeerRecord(peerId, blockchain);
    }

    async getAllPeerRecords(blockchain) {
        return this.getRepository('shard').getAllPeerRecords(blockchain);
    }

    async getPeerRecordsByIds(blockchain, peerIds) {
        return this.getRepository('shard').getPeerRecordsByIds(blockchain, peerIds);
    }

    async getPeersCount(blockchain) {
        return this.getRepository('shard').getPeersCount(blockchain);
    }

    async getPeersToDial(limit, dialFrequencyMillis) {
        return this.getRepository('shard').getPeersToDial(limit, dialFrequencyMillis);
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

    async getNeighbourhood(assertionId, r2) {
        return this.getRepository('shard').getNeighbourhood(assertionId, r2);
    }

    async cleanShardingTable(blockchainId, options = {}) {
        return this.getRepository('shard').cleanShardingTable(blockchainId, options);
    }

    async isNodePartOfShard(blockchainId, peerId) {
        return this.getRepository('shard').isNodePartOfShard(blockchainId, peerId);
    }

    async createEventRecord(
        operationId,
        blockchainId,
        name,
        timestamp,
        value1 = null,
        value2 = null,
        value3 = null,
        options = {},
    ) {
        return this.getRepository('event').createEventRecord(
            operationId,
            blockchainId,
            name,
            timestamp,
            value1,
            value2,
            value3,
            options,
        );
    }

    async getUnpublishedEvents() {
        return this.getRepository('event').getUnpublishedEvents();
    }

    async destroyEvents(ids, options = {}) {
        return this.getRepository('event').destroyEvents(ids, options);
    }

    async getUser(username) {
        return this.getRepository('user').getUser(username);
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

    async isTokenRevoked(tokenId) {
        return this.getRepository('token').isTokenRevoked(tokenId);
    }

    async getTokenAbilities(tokenId) {
        return this.getRepository('token').getTokenAbilities(tokenId);
    }

    async insertBlockchainEvents(events, options = {}) {
        return this.getRepository('blockchain_event').insertBlockchainEvents(events, options);
    }

    async getAllUnprocessedBlockchainEvents(blockchain, eventNames) {
        return this.getRepository('blockchain_event').getAllUnprocessedBlockchainEvents(
            blockchain,
            eventNames,
        );
    }

    async markBlockchainEventsAsProcessed(events, options = {}) {
        return this.getRepository('blockchain_event').markBlockchainEventsAsProcessed(
            events,
            options,
        );
    }

    async markAllContractBlockchainEventsAsProcessed(contract, options = {}) {
        return this.getRepository('blockchain_event').markAllContractBlockchainEventsAsProcessed(
            contract,
            options,
        );
    }

    async removeEvents(ids, options = {}) {
        return this.getRepository('blockchain_event').removeEvents(ids, options);
    }

    async findProcessedEvents(timestamp, limit) {
        return this.getRepository('blockchain_event').findProcessedEvents(timestamp, limit);
    }

    async getLastCheckedBlock(blockchain, contract = null) {
        return this.getRepository('blockchain').getLastCheckedBlock(blockchain, contract);
    }

    async updateLastCheckedBlock(blockchain, contracts, currentBlock, timestamp, options = {}) {
        return this.getRepository('blockchain').updateLastCheckedBlock(
            blockchain,
            contracts,
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

    async paranetExists(paranetId, blockchainId) {
        return this.getRepository('paranet').paranetExists(paranetId, blockchainId);
    }

    async getParanet(paranetId, blockchainId) {
        return this.getRepository('paranet').getParanet(paranetId, blockchainId);
    }

    async getParanetKnowledgeAssetsCount(paranetId, blockchainId) {
        return this.getRepository('paranet').getParanetKnowledgeAssetsCount(
            paranetId,
            blockchainId,
        );
    }

    async createMissedParanetAssetRecord(missedParanetAssset, options = {}) {
        return this.getRepository('missed_paranet_asset').createMissedParanetAssetRecord(
            missedParanetAssset,
            options,
        );
    }

    async getMissedParanetAssetRecords(blockchainId) {
        return this.getRepository('missed_paranet_asset').getMissedParanetAssetRecords(
            blockchainId,
        );
    }

    async missedParanetAssetRecordExists(ual) {
        return this.getRepository('missed_paranet_asset').missedParanetAssetRecordExists(ual);
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
    ) {
        return this.getRepository(
            'missed_paranet_asset',
        ).getMissedParanetAssetsRecordsWithRetryCount(
            paranetUal,
            retryCountLimit,
            retryDelayInMs,
            limit,
        );
    }

    async getCountOfMissedAssetsOfParanet(ual) {
        return this.getRepository('missed_paranet_asset').getCountOfMissedAssetsOfParanet(ual);
    }

    async getFilteredCountOfMissedAssetsOfParanet(ual, retryCountLimit, retryDelayInMs) {
        return this.getRepository('missed_paranet_asset').getFilteredCountOfMissedAssetsOfParanet(
            ual,
            retryCountLimit,
            retryDelayInMs,
        );
    }

    async getParanetsBlockchains() {
        return this.getRepository('paranet').getParanetsBlockchains();
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
        return this.getRepository('paranet_synced_asset').createParanetSyncedAssetRecord(
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

    async getParanetSyncedAssetRecordByUAL(ual) {
        return this.getRepository('paranet_synced_asset').getParanetSyncedAssetRecordByUAL(ual);
    }

    async getParanetSyncedAssetRecordsCountByDataSource(paranetUal, dataSource) {
        return this.getRepository(
            'paranet_synced_asset',
        ).getParanetSyncedAssetRecordsCountByDataSource(paranetUal, dataSource);
    }

    async paranetSyncedAssetRecordExists(ual) {
        return this.getRepository('paranet_synced_asset').paranetSyncedAssetRecordExists(ual);
    }

    async incrementParanetKaCount(paranetId, blockchainId, options = {}) {
        return this.getRepository('paranet').incrementParanetKaCount(
            paranetId,
            blockchainId,
            options,
        );
    }
}

export default RepositoryModuleManager;
