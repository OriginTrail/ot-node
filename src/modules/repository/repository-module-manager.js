import BaseModuleManager from '../base-module-manager.js';

class RepositoryModuleManager extends BaseModuleManager {
    getName() {
        return 'repository';
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

    // COMMANDS
    async updateCommand(update, opts) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('command')
                .updateCommand(update, opts);
        }
    }

    async destroyCommand(name) {
        if (this.initialized) {
            return this.getImplementation().module.getRepository('command').destroyCommand(name);
        }
    }

    async createCommand(command, opts) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('command')
                .createCommand(command, opts);
        }
    }

    async getCommandsWithStatus(statusArray, excludeNameArray = []) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('command')
                .getCommandsWithStatus(statusArray, excludeNameArray);
        }
    }

    async getCommandWithId(id) {
        if (this.initialized) {
            return this.getImplementation().module.getRepository('command').getCommandWithId(id);
        }
    }

    async removeFinalizedCommands(finalizedStatuses) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('command')
                .removeFinalizedCommands(finalizedStatuses);
        }
    }

    // OPERATION ID TABLE
    async createOperationIdRecord(handlerData) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('operation_id')
                .createOperationIdRecord(handlerData);
        }
    }

    async updateOperationIdRecord(data, operationId) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('operation_id')
                .updateOperationIdRecord(data, operationId);
        }
    }

    async getOperationIdRecord(operationId) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('operation_id')
                .getOperationIdRecord(operationId);
        }
    }

    async removeOperationIdRecord(timeToBeDeleted, statuses) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('operation_id')
                .removeOperationIdRecord(timeToBeDeleted, statuses);
        }
    }

    // publish table
    async createOperationRecord(operation, operationId, status) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('operation')
                .createOperationRecord(operation, operationId, status);
        }
    }

    async getOperationStatus(operation, operationId) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('operation')
                .getOperationStatus(operation, operationId);
        }
    }

    async updateOperationStatus(operation, operationId, status) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('operation')
                .updateOperationStatus(operation, operationId, status);
        }
    }

    async createOperationResponseRecord(status, operation, operationId, keyword, errorMessage) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('operation_response')
                .createOperationResponseRecord(
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
            return this.getImplementation()
                .module.getRepository('operation_response')
                .getOperationResponsesStatuses(operation, operationId);
        }
    }

    // Sharding Table
    async createManyPeerRecords(peers) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('shard')
                .createManyPeerRecords(peers);
        }
    }

    async removeShardingTablePeerRecords(blockchain) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('shard')
                .removeShardingTablePeerRecords(blockchain);
        }
    }

    async createPeerRecord(peerId, blockchain, ask, stake, lastSeen, sha256) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('shard')
                .createPeerRecord(peerId, blockchain, ask, stake, lastSeen, sha256);
        }
    }

    async getPeerRecord(peerId, blockchain) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('shard')
                .getPeerRecord(peerId, blockchain);
        }
    }

    async getAllPeerRecords(blockchain, filterLastSeen) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('shard')
                .getAllPeerRecords(blockchain, filterLastSeen);
        }
    }

    async getPeersCount(blockchain) {
        if (this.initialized) {
            return this.getImplementation().module.getRepository('shard').getPeersCount(blockchain);
        }
    }

    async getPeersToDial(limit, dialFrequencyMillis) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('shard')
                .getPeersToDial(limit, dialFrequencyMillis);
        }
    }

    async removePeerRecords(peerRecords) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('shard')
                .removePeerRecords(peerRecords);
        }
    }

    async updatePeerRecordLastDialed(peerId, timestamp) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('shard')
                .updatePeerRecordLastDialed(peerId, timestamp);
        }
    }

    async updatePeerRecordLastSeenAndLastDialed(peerId, timestamp) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('shard')
                .updatePeerRecordLastSeenAndLastDialed(peerId, timestamp);
        }
    }

    async updatePeersAsk(peerRecords) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('shard')
                .updatePeersAsk(peerRecords);
        }
    }

    async updatePeersStake(peerRecords) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('shard')
                .updatePeersStake(peerRecords);
        }
    }

    async getNeighbourhood(assertionId, r2) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('shard')
                .getNeighbourhood(assertionId, r2);
        }
    }

    async cleanShardingTable(blockchainId) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('shard')
                .cleanShardingTable(blockchainId);
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
            return this.getImplementation()
                .module.getRepository('event')
                .createEventRecord(operationId, name, timestamp, value1, value2, value3);
        }
    }

    async getUnpublishedEvents() {
        if (this.initialized) {
            return this.getImplementation().module.getRepository('event').getUnpublishedEvents();
        }
    }

    async destroyEvents(ids) {
        if (this.initialized) {
            return this.getImplementation().module.getRepository('event').destroyEvents(ids);
        }
    }

    async getUser(username) {
        if (this.initialized) {
            return this.getImplementation().module.getRepository('user').getUser(username);
        }
    }

    async saveToken(tokenId, userId, tokenName, expiresAt) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('token')
                .saveToken(tokenId, userId, tokenName, expiresAt);
        }
    }

    async isTokenRevoked(tokenId) {
        if (this.initialized) {
            return this.getImplementation().module.getRepository('token').isTokenRevoked(tokenId);
        }
    }

    async getTokenAbilities(tokenId) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('token')
                .getTokenAbilities(tokenId);
        }
    }

    async insertBlockchainEvents(events) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('blockchain_event')
                .insertBlockchainEvents(events);
        }
    }

    async getAllUnprocessedBlockchainEvents(eventNames) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('blockchain_event')
                .getAllUnprocessedBlockchainEvents(eventNames);
        }
    }

    async markBlockchainEventsAsProcessed(events) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('blockchain_event')
                .markBlockchainEventsAsProcessed(events);
        }
    }

    async removeBlockchainEvents(contract) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('blockchain_event')
                .removeBlockchainEvents(contract);
        }
    }

    async removeLastCheckedBlockForContract(contract) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('blockchain')
                .removeLastCheckedBlockForContract(contract);
        }
    }

    async getLastCheckedBlock(blockchainId, contract) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('blockchain')
                .getLastCheckedBlock(blockchainId, contract);
        }
    }

    async updateLastCheckedBlock(blockchainId, currentBlock, timestamp, contract) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('blockchain')
                .updateLastCheckedBlock(blockchainId, currentBlock, timestamp, contract);
        }
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
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('service_agreement')
                .updateServiceAgreementRecord(
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
    }

    async removeServiceAgreementRecord(blockchainId, contract, tokenId) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('service_agreement')
                .removeServiceAgreementRecord(blockchainId, contract, tokenId);
        }
    }

    async removeServiceAgreements(agreementIds) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('service_agreement')
                .removeServiceAgreements(agreementIds);
        }
    }

    async updateServiceAgreementEpochsNumber(agreementId, epochsNumber) {
        if (this.initialized) {
            return this.getImplementation()
                .module.getRepository('service_agreement')
                .updateServiceAgreementEpochsNumber(agreementId, epochsNumber);
        }
    }
}

export default RepositoryModuleManager;
