import BaseModuleManager from '../base-module-manager.js';

class RepositoryModuleManager extends BaseModuleManager {
    getName() {
        return 'repository';
    }

    async createAssetSyncRecord(blockchain, contract, tokenId, stateIndex, status) {
        if (this.initialized) {
            return this.getImplementation().module.createAssetSyncRecord(
                blockchain,
                contract,
                tokenId,
                stateIndex,
                status,
            );
        }
    }

    async updateAssetSyncRecord(blockchain, contract, tokenId, stateIndex, status) {
        if (this.initialized) {
            return this.getImplementation().module.updateAssetSyncRecord(
                blockchain,
                contract,
                tokenId,
                stateIndex,
                status,
            );
        }
    }

    async getLatestAssetSyncRecord(blockchain, contract) {
        if (this.initialized) {
            return this.getImplementation().module.getLatestAssetSyncRecord(blockchain, contract);
        }
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

    // COMMANDS
    async updateCommand(update, opts) {
        if (this.initialized) {
            return this.getImplementation().module.updateCommand(update, opts);
        }
    }

    async destroyCommand(name) {
        if (this.initialized) {
            return this.getImplementation().module.destroyCommand(name);
        }
    }

    async createCommand(command, opts) {
        if (this.initialized) {
            return this.getImplementation().module.createCommand(command, opts);
        }
    }

    async getCommandsWithStatus(statusArray, excludeNameArray = []) {
        if (this.initialized) {
            return this.getImplementation().module.getCommandsWithStatus(
                statusArray,
                excludeNameArray,
            );
        }
    }

    async getCommandWithId(id) {
        if (this.initialized) {
            return this.getImplementation().module.getCommandWithId(id);
        }
    }

    async removeFinalizedCommands(finalizedStatuses) {
        if (this.initialized) {
            return this.getImplementation().module.removeFinalizedCommands(finalizedStatuses);
        }
    }

    // OPERATION ID TABLE
    async createOperationIdRecord(handlerData) {
        if (this.initialized) {
            return this.getImplementation().module.createOperationIdRecord(handlerData);
        }
    }

    async updateOperationIdRecord(data, operationId) {
        if (this.initialized) {
            return this.getImplementation().module.updateOperationIdRecord(data, operationId);
        }
    }

    async getOperationIdRecord(operationId) {
        if (this.initialized) {
            return this.getImplementation().module.getOperationIdRecord(operationId);
        }
    }

    async removeOperationIdRecord(timeToBeDeleted, statuses) {
        if (this.initialized) {
            return this.getImplementation().module.removeOperationIdRecord(
                timeToBeDeleted,
                statuses,
            );
        }
    }

    // publish table
    async createOperationRecord(operation, operationId, status) {
        if (this.initialized) {
            return this.getImplementation().module.createOperationRecord(
                operation,
                operationId,
                status,
            );
        }
    }

    async getOperationStatus(operation, operationId) {
        if (this.initialized) {
            return this.getImplementation().module.getOperationStatus(operation, operationId);
        }
    }

    async updateOperationStatus(operation, operationId, status) {
        if (this.initialized) {
            return this.getImplementation().module.updateOperationStatus(
                operation,
                operationId,
                status,
            );
        }
    }

    async createOperationResponseRecord(status, operation, operationId, keyword, errorMessage) {
        if (this.initialized) {
            return this.getImplementation().module.createOperationResponseRecord(
                status,
                operation,
                operationId,
                keyword,
                errorMessage,
            );
        }
    }

    async getOperationResponsesStatuses(operation, operationId) {
        if (this.initialized) {
            return this.getImplementation().module.getOperationResponsesStatuses(
                operation,
                operationId,
            );
        }
    }

    // Sharding Table
    async createManyPeerRecords(peers) {
        if (this.initialized) {
            return this.getImplementation().module.createManyPeerRecords(peers);
        }
    }

    async removeShardingTablePeerRecords(blockchain) {
        if (this.initialized) {
            return this.getImplementation().module.removeShardingTablePeerRecords(blockchain);
        }
    }

    async createPeerRecord(peerId, blockchain, ask, stake, lastSeen, sha256) {
        if (this.initialized) {
            return this.getImplementation().module.createPeerRecord(
                peerId,
                blockchain,
                ask,
                stake,
                lastSeen,
                sha256,
            );
        }
    }

    async getPeerRecord(peerId, blockchain) {
        if (this.initialized) {
            return this.getImplementation().module.getPeerRecord(peerId, blockchain);
        }
    }

    async getAllPeerRecords(blockchain, filterLastSeen) {
        if (this.initialized) {
            return this.getImplementation().module.getAllPeerRecords(blockchain, filterLastSeen);
        }
    }

    async getPeersCount(blockchain) {
        if (this.initialized) {
            return this.getImplementation().module.getPeersCount(blockchain);
        }
    }

    async getPeersToDial(limit, dialFrequencyMillis) {
        if (this.initialized) {
            return this.getImplementation().module.getPeersToDial(limit, dialFrequencyMillis);
        }
    }

    async query(query) {
        if (this.initialized) {
            return this.getImplementation().module.query(query);
        }
    }

    async removePeerRecords(peerRecords) {
        if (this.initialized) {
            return this.getImplementation().module.removePeerRecords(peerRecords);
        }
    }

    async updatePeerRecordLastDialed(peerId, timestamp) {
        if (this.initialized) {
            return this.getImplementation().module.updatePeerRecordLastDialed(peerId, timestamp);
        }
    }

    async updatePeerRecordLastSeenAndLastDialed(peerId, timestamp) {
        if (this.initialized) {
            return this.getImplementation().module.updatePeerRecordLastSeenAndLastDialed(
                peerId,
                timestamp,
            );
        }
    }

    async updatePeersAsk(peerRecords) {
        if (this.initialized) {
            return this.getImplementation().module.updatePeersAsk(peerRecords);
        }
    }

    async updatePeersStake(peerRecords) {
        if (this.initialized) {
            return this.getImplementation().module.updatePeersStake(peerRecords);
        }
    }

    async getNeighbourhood(assertionId, r2) {
        if (this.initialized) {
            return this.getImplementation().module.getNeighbourhood(assertionId, r2);
        }
    }

    async cleanShardingTable(blockchainId) {
        if (this.initialized) {
            return this.getImplementation().module.cleanShardingTable(blockchainId);
        }
    }

    // EVENT
    async createEventRecord(
        operationId,
        name,
        timestamp,
        value1 = null,
        value2 = null,
        value3 = null,
    ) {
        if (this.initialized) {
            return this.getImplementation().module.createEventRecord(
                operationId,
                name,
                timestamp,
                value1,
                value2,
                value3,
            );
        }
    }

    async getUnpublishedEvents() {
        if (this.initialized) {
            return this.getImplementation().module.getUnpublishedEvents();
        }
    }

    async destroyEvents(ids) {
        if (this.initialized) {
            return this.getImplementation().module.destroyEvents(ids);
        }
    }

    async getUser(username) {
        if (this.initialized) {
            return this.getImplementation().module.getUser(username);
        }
    }

    async saveToken(tokenId, userId, tokenName, expiresAt) {
        if (this.initialized) {
            return this.getImplementation().module.saveToken(tokenId, userId, tokenName, expiresAt);
        }
    }

    async isTokenRevoked(tokenId) {
        if (this.initialized) {
            return this.getImplementation().module.isTokenRevoked(tokenId);
        }
    }

    async getTokenAbilities(tokenId) {
        if (this.initialized) {
            return this.getImplementation().module.getTokenAbilities(tokenId);
        }
    }

    async insertBlockchainEvents(events) {
        if (this.initialized) {
            return this.getImplementation().module.insertBlockchainEvents(events);
        }
    }

    async getAllUnprocessedBlockchainEvents(eventNames) {
        if (this.initialized) {
            return this.getImplementation().module.getAllUnprocessedBlockchainEvents(eventNames);
        }
    }

    async markBlockchainEventsAsProcessed(events) {
        if (this.initialized) {
            return this.getImplementation().module.markBlockchainEventsAsProcessed(events);
        }
    }

    async removeBlockchainEvents(contract) {
        if (this.initialized) {
            return this.getImplementation().module.removeBlockchainEvents(contract);
        }
    }

    async removeLastCheckedBlockForContract(contract) {
        if (this.initialized) {
            return this.getImplementation().module.removeLastCheckedBlockForContract(contract);
        }
    }

    async getLastCheckedBlock(blockchainId, contract) {
        if (this.initialized) {
            return this.getImplementation().module.getLastCheckedBlock(blockchainId, contract);
        }
    }

    async updateLastCheckedBlock(blockchainId, currentBlock, timestamp, contract) {
        if (this.initialized) {
            return this.getImplementation().module.updateLastCheckedBlock(
                blockchainId,
                currentBlock,
                timestamp,
                contract,
            );
        }
    }
}

export default RepositoryModuleManager;
