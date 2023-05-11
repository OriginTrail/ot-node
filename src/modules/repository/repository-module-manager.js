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

    transaction(execFn) {
        if (this.initialized) {
            return this.getImplementation().module.transaction(execFn);
        }
    }

    async dropDatabase() {
        if (this.initialized) {
            return this.getImplementation().module.dropDatabase();
        }
    }

    async query(query) {
        if (this.initialized) {
            return this.getImplementation().module.query(query);
        }
    }

    async updateCommand(update, opts) {
        return this.getRepository('command').updateCommand(update, opts);
    }

    async destroyCommand(name) {
        return this.getRepository('command').destroyCommand(name);
    }

    async createCommand(command, opts) {
        return this.getRepository('command').createCommand(command, opts);
    }

    async getCommandsWithStatus(statusArray, excludeNameArray = []) {
        return this.getRepository('command').getCommandsWithStatus(statusArray, excludeNameArray);
    }

    async getCommandWithId(id) {
        return this.getRepository('command').getCommandWithId(id);
    }

    async removeFinalizedCommands(finalizedStatuses) {
        return this.getRepository('command').removeFinalizedCommands(finalizedStatuses);
    }

    async createOperationIdRecord(handlerData) {
        return this.getRepository('operation_id').createOperationIdRecord(handlerData);
    }

    async updateOperationIdRecord(data, operationId) {
        return this.getRepository('operation_id').updateOperationIdRecord(data, operationId);
    }

    async getOperationIdRecord(operationId) {
        return this.getRepository('operation_id').getOperationIdRecord(operationId);
    }

    async removeOperationIdRecord(timeToBeDeleted, statuses) {
        return this.getRepository('operation_id').removeOperationIdRecord(
            timeToBeDeleted,
            statuses,
        );
    }

    async createOperationRecord(operation, operationId, status) {
        return this.getRepository('operation').createOperationRecord(
            operation,
            operationId,
            status,
        );
    }

    async getOperationStatus(operation, operationId) {
        return this.getRepository('operation').getOperationStatus(operation, operationId);
    }

    async updateOperationStatus(operation, operationId, status) {
        return this.getRepository('operation').updateOperationStatus(
            operation,
            operationId,
            status,
        );
    }

    async createOperationResponseRecord(status, operation, operationId, keyword, errorMessage) {
        return this.getRepository('operation_response').createOperationResponseRecord(
            status,
            operation,
            operationId,
            keyword,
            errorMessage,
        );
    }

    async getOperationResponsesStatuses(operation, operationId) {
        return this.getRepository('operation_response').getOperationResponsesStatuses(
            operation,
            operationId,
        );
    }

    // Sharding Table
    async createManyPeerRecords(peers) {
        return this.getRepository('shard').createManyPeerRecords(peers);
    }

    async removeShardingTablePeerRecords(blockchain) {
        return this.getRepository('shard').removeShardingTablePeerRecords(blockchain);
    }

    async createPeerRecord(peerId, blockchain, ask, stake, lastSeen, sha256) {
        return this.getRepository('shard').createPeerRecord(
            peerId,
            blockchain,
            ask,
            stake,
            lastSeen,
            sha256,
        );
    }

    async getPeerRecord(peerId, blockchain) {
        return this.getRepository('shard').getPeerRecord(peerId, blockchain);
    }

    async getAllPeerRecords(blockchain, filterLastSeen) {
        return this.getRepository('shard').getAllPeerRecords(blockchain, filterLastSeen);
    }

    async getPeersCount(blockchain) {
        return this.getRepository('shard').getPeersCount(blockchain);
    }

    async getPeersToDial(limit, dialFrequencyMillis) {
        return this.getRepository('shard').getPeersToDial(limit, dialFrequencyMillis);
    }

    async removePeerRecords(peerRecords) {
        return this.getRepository('shard').removePeerRecords(peerRecords);
    }

    async updatePeerRecordLastDialed(peerId, timestamp) {
        return this.getRepository('shard').updatePeerRecordLastDialed(peerId, timestamp);
    }

    async updatePeerRecordLastSeenAndLastDialed(peerId, timestamp) {
        return this.getRepository('shard').updatePeerRecordLastSeenAndLastDialed(peerId, timestamp);
    }

    async updatePeersAsk(peerRecords) {
        return this.getRepository('shard').updatePeersAsk(peerRecords);
    }

    async updatePeersStake(peerRecords) {
        return this.getRepository('shard').updatePeersStake(peerRecords);
    }

    async getNeighbourhood(assertionId, r2) {
        return this.getRepository('shard').getNeighbourhood(assertionId, r2);
    }

    async cleanShardingTable(blockchainId) {
        return this.getRepository('shard').cleanShardingTable(blockchainId);
    }

    async createEventRecord(
        operationId,
        name,
        timestamp,
        value1 = null,
        value2 = null,
        value3 = null,
    ) {
        return this.getRepository('event').createEventRecord(
            operationId,
            name,
            timestamp,
            value1,
            value2,
            value3,
        );
    }

    async getUnpublishedEvents() {
        return this.getRepository('event').getUnpublishedEvents();
    }

    async destroyEvents(ids) {
        return this.getRepository('event').destroyEvents(ids);
    }

    async getUser(username) {
        return this.getRepository('user').getUser(username);
    }

    async saveToken(tokenId, userId, tokenName, expiresAt) {
        return this.getRepository('token').saveToken(tokenId, userId, tokenName, expiresAt);
    }

    async isTokenRevoked(tokenId) {
        return this.getRepository('token').isTokenRevoked(tokenId);
    }

    async getTokenAbilities(tokenId) {
        return this.getRepository('token').getTokenAbilities(tokenId);
    }

    async insertBlockchainEvents(events) {
        return this.getRepository('blockchain_event').insertBlockchainEvents(events);
    }

    async getAllUnprocessedBlockchainEvents(eventNames) {
        return this.getRepository('blockchain_event').getAllUnprocessedBlockchainEvents(eventNames);
    }

    async markBlockchainEventsAsProcessed(events) {
        return this.getRepository('blockchain_event').markBlockchainEventsAsProcessed(events);
    }

    async removeBlockchainEvents(contract) {
        return this.getRepository('blockchain_event').removeBlockchainEvents(contract);
    }

    async removeLastCheckedBlockForContract(contract) {
        return this.getRepository('blockchain_event').removeLastCheckedBlockForContract(contract);
    }

    async getLastCheckedBlock(blockchainId, contract) {
        return this.getRepository('blockchain_event').getLastCheckedBlock(blockchainId, contract);
    }

    async updateLastCheckedBlock(blockchainId, currentBlock, timestamp, contract) {
        return this.getRepository('blockchain_event').updateLastCheckedBlock(
            blockchainId,
            currentBlock,
            timestamp,
            contract,
        );
    }

    async updateServiceAgreementRecord(
        blockchainId,
        contract,
        tokenId,
        agreementId,
        startTime,
        epochsNumber,
        epochLength,
        scoreFunctionId,
        proofWindowOffsetPerc,
        hashFunctionId,
        keyword,
        assertionId,
        stateIndex,
        lastCommitEpoch,
        lastProofEpoch,
    ) {
        return this.getRepository('blockchain_event').updateServiceAgreementRecord(
            blockchainId,
            contract,
            tokenId,
            agreementId,
            startTime,
            epochsNumber,
            epochLength,
            scoreFunctionId,
            proofWindowOffsetPerc,
            hashFunctionId,
            keyword,
            assertionId,
            stateIndex,
            lastCommitEpoch,
            lastProofEpoch,
        );
    }

    async removeServiceAgreementRecord(blockchainId, contract, tokenId) {
        return this.getRepository('blockchain_event').removeServiceAgreementRecord(
            blockchainId,
            contract,
            tokenId,
        );
    }

    async removeServiceAgreements(agreementIds) {
        return this.getRepository('blockchain_event').removeServiceAgreements(agreementIds);
    }

    async updateServiceAgreementEpochsNumber(agreementId, epochsNumber) {
        return this.getRepository('blockchain_event').updateServiceAgreementEpochsNumber(
            agreementId,
            epochsNumber,
        );
    }
}

export default RepositoryModuleManager;
