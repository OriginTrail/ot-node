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

    async destroyAllRecords(table) {
        if (this.initialized) {
            return this.getImplementation().module.destroyAllRecords(table);
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

    async removeCommands(ids) {
        return this.getRepository('command').removeCommands(ids);
    }

    async findFinalizedCommands(timestamp, limit) {
        return this.getRepository('command').findFinalizedCommands(timestamp, limit);
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

    async removeOperationRecords(operation, ids) {
        return this.getRepository('operation').removeOperationRecords(operation, ids);
    }

    async findProcessedOperations(operation, timestamp, limit) {
        return this.getRepository('operation').findProcessedOperations(operation, timestamp, limit);
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

    async findProcessedOperationResponse(timestamp, limit, operation) {
        return this.getRepository('operation_response').findProcessedOperationResponse(
            timestamp,
            limit,
            operation,
        );
    }

    async removeOperationResponse(ids, operation) {
        return this.getRepository('operation_response').removeOperationResponse(ids, operation);
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

    async removePeerRecord(blockchain, peerId) {
        return this.getRepository('shard').removePeerRecord(blockchain, peerId);
    }

    async updatePeerRecordLastDialed(peerId, timestamp) {
        return this.getRepository('shard').updatePeerRecordLastDialed(peerId, timestamp);
    }

    async updatePeerRecordLastSeenAndLastDialed(peerId, timestamp) {
        return this.getRepository('shard').updatePeerRecordLastSeenAndLastDialed(peerId, timestamp);
    }

    async updatePeerAsk(peerId, blockchainId, ask) {
        return this.getRepository('shard').updatePeerAsk(peerId, blockchainId, ask);
    }

    async updatePeerStake(peerId, blockchainId, stake) {
        return this.getRepository('shard').updatePeerStake(peerId, blockchainId, stake);
    }

    async getNeighbourhood(assertionId, r2) {
        return this.getRepository('shard').getNeighbourhood(assertionId, r2);
    }

    async cleanShardingTable(blockchainId) {
        return this.getRepository('shard').cleanShardingTable(blockchainId);
    }

    async createEventRecord(
        operationId,
        blockchainId,
        name,
        timestamp,
        value1 = null,
        value2 = null,
        value3 = null,
    ) {
        return this.getRepository('event').createEventRecord(
            operationId,
            blockchainId,
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

    async getAllUnprocessedBlockchainEvents(eventNames, blockchainId) {
        return this.getRepository('blockchain_event').getAllUnprocessedBlockchainEvents(
            eventNames,
            blockchainId,
        );
    }

    async markBlockchainEventsAsProcessed(events) {
        return this.getRepository('blockchain_event').markBlockchainEventsAsProcessed(events);
    }

    async removeBlockchainEvents(contract) {
        return this.getRepository('blockchain_event').removeBlockchainEvents(contract);
    }

    async removeEvents(ids) {
        return this.getRepository('blockchain_event').removeEvents(ids);
    }

    async findProcessedEvents(timestamp, limit) {
        return this.getRepository('blockchain_event').findProcessedEvents(timestamp, limit);
    }

    async removeLastCheckedBlockForContract(contract) {
        return this.getRepository('blockchain').removeLastCheckedBlockForContract(contract);
    }

    async getLastCheckedBlock(blockchainId, contract) {
        return this.getRepository('blockchain').getLastCheckedBlock(blockchainId, contract);
    }

    async updateLastCheckedBlock(blockchainId, currentBlock, timestamp, contract) {
        return this.getRepository('blockchain').updateLastCheckedBlock(
            blockchainId,
            currentBlock,
            timestamp,
            contract,
        );
    }

    async getOrCreateParanetById(paranetId) {
        return this.getRepository('paranet').getOrCreateParanet(paranetId);
    }

    async updateParanetKaCount(paranetId, blockchainId, kaCount) {
        return this.getRepository('paranet').updateParanetKaCount(paranetId, blockchainId, kaCount);
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
        dataSource,
        lastCommitEpoch,
        lastProofEpoch,
    ) {
        if (this.initialized) {
            return this.getRepository('service_agreement').updateServiceAgreementRecord(
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
                dataSource,
                lastCommitEpoch,
                lastProofEpoch,
            );
        }
    }

    async updateServiceAgreementForTokenId(tokenId, agreementId, keyword, assertionId, stateIndex) {
        if (this.initialized) {
            return this.getRepository('service_agreement').updateServiceAgreementForTokenId(
                tokenId,
                agreementId,
                keyword,
                assertionId,
                stateIndex,
            );
        }
    }

    async serviceAgreementExists(blockchain, tokenId) {
        if (this.initialized) {
            return this.getRepository('service_agreement').serviceAgreementExists(
                blockchain,
                tokenId,
            );
        }
    }

    async bulkCreateServiceAgreementRecords(records) {
        if (this.initialized) {
            return this.getRepository('service_agreement').bulkCreateServiceAgreementRecords(
                records,
            );
        }
    }

    async getServiceAgreementRecord(agreementId) {
        if (this.initialized) {
            return this.getRepository('service_agreement').getServiceAgreementRecord(agreementId);
        }
    }

    async updateServiceAgreementLastCommitEpoch(agreementId, lastCommitEpoch) {
        if (this.initialized) {
            return this.getRepository('service_agreement').updateServiceAgreementLastCommitEpoch(
                agreementId,
                lastCommitEpoch,
            );
        }
    }

    async updateServiceAgreementLastProofEpoch(agreementId, lastProofEpoch) {
        if (this.initialized) {
            return this.getRepository('service_agreement').updateServiceAgreementLastProofEpoch(
                agreementId,
                lastProofEpoch,
            );
        }
    }

    async removeServiceAgreementRecord(blockchainId, contract, tokenId) {
        if (this.initialized) {
            return this.getRepository('service_agreement').removeServiceAgreementRecord(
                blockchainId,
                contract,
                tokenId,
            );
        }
    }

    async getCountOfServiceAgreementsByBlockchainAndContract(blockchainId, contract) {
        if (this.initialized) {
            return this.getRepository(
                'service_agreement',
            ).getCountOfServiceAgreementsByBlockchainAndContract(blockchainId, contract);
        }
    }

    async removeServiceAgreementsByBlockchainAndContract(blockchainId, contract) {
        if (this.initialized) {
            return this.getRepository(
                'service_agreement',
            ).removeServiceAgreementsByBlockchainAndContract(blockchainId, contract);
        }
    }

    async getEligibleAgreementsForSubmitCommit(
        timestampSeconds,
        blockchain,
        commitWindowDurationPerc,
        ask,
        startTimeDelay,
    ) {
        if (this.initialized) {
            return this.getRepository('service_agreement').getEligibleAgreementsForSubmitCommit(
                timestampSeconds,
                blockchain,
                commitWindowDurationPerc,
                ask,
                startTimeDelay,
            );
        }
    }

    async getEligibleAgreementsForSubmitProof(
        timestampSeconds,
        blockchain,
        proofWindowDurationPerc,
    ) {
        if (this.initialized) {
            return this.getRepository('service_agreement').getEligibleAgreementsForSubmitProof(
                timestampSeconds,
                blockchain,
                proofWindowDurationPerc,
            );
        }
    }

    async removeServiceAgreements(agreementIds) {
        return this.getRepository('service_agreement').removeServiceAgreements(agreementIds);
    }

    async removeServiceAgreementsForBlockchain(blockchainId) {
        return this.getRepository('service_agreement').removeServiceAgreementsForBlockchain(
            blockchainId,
        );
    }

    async updateServiceAgreementEpochsNumber(agreementId, epochsNumber) {
        return this.getRepository('service_agreement').updateServiceAgreementEpochsNumber(
            agreementId,
            epochsNumber,
        );
    }

    async getNumberOfActiveServiceAgreements() {
        return this.getRepository('service_agreement').getNumberOfActiveServiceAgreements();
    }

    async getServiceAgreements(fromTokenId, batchSize) {
        return this.getRepository('service_agreement').getServiceAgreements(fromTokenId, batchSize);
    }

    async getServiceAgreementsTokenIds(fromTokenId, blockchainId) {
        return this.getRepository('service_agreement').getServiceAgreementsTokenIds(
            fromTokenId,
            blockchainId,
        );
    }

    async getLatestServiceAgreementTokenId(blockchainId) {
        return this.getRepository('service_agreement').getLatestServiceAgreementTokenId(
            blockchainId,
        );
    }

    async findDuplicateServiceAgreements(blockchainId) {
        return this.getRepository('service_agreement').findDuplicateServiceAgreements(blockchainId);
    }

    async findServiceAgreementsByTokenIds(tokenIds, blockchainId) {
        return this.getRepository('service_agreement').findServiceAgreementsByTokenIds(
            tokenIds,
            blockchainId,
        );
    }

    async createParanetRecord(name, description, paranetId, blockchainId) {
        this.getRepository('paranet').createParanetRecord(
            name,
            description,
            paranetId,
            blockchainId,
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

    async createMissedParanetAssetRecord(missedParanetAssset) {
        return this.getRepository('missed_paranet_asset').createMissedParanetAssetRecord(
            missedParanetAssset,
        );
    }

    async getMissedParanetAssetRecords(blockchainId) {
        return this.getRepository('missed_paranet_asset').getMissedParanetAssetRecords(
            blockchainId,
        );
    }

    async removeMissedParanetAssetRecordsByUAL(ual) {
        return this.getRepository('missed_paranet_asset').removeMissedParanetAssetRecordsByUAL(ual);
    }

    async getMissedParanetAssetsRecordsWithRetryCount(
        paranetUal,
        retryCountLimit,
        retryDelayInMs,
        count,
    ) {
        return this.getRepository(
            'missed_paranet_asset',
        ).getMissedParanetAssetsRecordsWithRetryCount(
            paranetUal,
            retryCountLimit,
            retryDelayInMs,
            count,
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
    ) {
        return this.getRepository('paranet_synced_asset').createParanetSyncedAssetRecord(
            blockchainId,
            ual,
            paranetUal,
            publicAssertionId,
            privateAssertionId,
            sender,
            transactionHash,
        );
    }

    async getParanetSyncedAssetRecordByUAL(ual) {
        return this.getRepository('paranet_synced_asset').getParanetSyncedAssetRecordByUAL(ual);
    }
}

export default RepositoryModuleManager;
