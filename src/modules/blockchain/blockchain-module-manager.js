import BaseModuleManager from '../base-module-manager.js';

class BlockchainModuleManager extends BaseModuleManager {
    getName() {
        return 'blockchain';
    }

    callImplementationFunction(blockchain, functionName, args = []) {
        if (blockchain) {
            if (this.getImplementation(blockchain)) {
                return this.getImplementation(blockchain).module[functionName](...args);
            }
        } else {
            return this.getImplementation().module[functionName](...args);
        }
    }

    initializeTransactionQueues(blockchain, concurrency) {
        return this.callImplementationFunction(blockchain, 'getTotalTransactionQueueLength', [
            concurrency,
        ]);
    }

    getTotalTransactionQueueLength(blockchain) {
        return this.callImplementationFunction(blockchain, 'getTotalTransactionQueueLength');
    }

    async initializeContracts(blockchain) {
        return this.callImplementationFunction(blockchain, 'initializeContracts');
    }

    initializeAssetStorageContract(blockchain, contractAddress) {
        return this.callImplementationFunction(blockchain, 'initializeAssetStorageContract', [
            contractAddress,
        ]);
    }

    initializeContract(blockchain, contractName, contractAddress) {
        return this.callImplementationFunction(blockchain, 'initializeContract', [
            contractName,
            contractAddress,
        ]);
    }

    getContractAddress(blockchain, contractName) {
        return this.callImplementationFunction(blockchain, 'getContractAddress', [contractName]);
    }

    setContractCallCache(blockchain, contractName, functionName, value) {
        return this.callImplementationFunction(blockchain, 'setContractCallCache', [
            contractName,
            functionName,
            value,
        ]);
    }

    getPublicKeys(blockchain) {
        return this.callImplementationFunction(blockchain, 'getPublicKeys');
    }

    getManagementKey(blockchain) {
        return this.callImplementationFunction(blockchain, 'getManagementKey');
    }

    async isAssetStorageContract(blockchain, contractAddress) {
        return this.callImplementationFunction(blockchain, 'isAssetStorageContract', [
            contractAddress,
        ]);
    }

    async getBlockNumber(blockchain) {
        return this.callImplementationFunction(blockchain, 'getBlockNumber');
    }

    async getIdentityId(blockchain) {
        return this.callImplementationFunction(blockchain, 'getIdentityId');
    }

    async identityIdExists(blockchain) {
        return this.callImplementationFunction(blockchain, 'identityIdExists');
    }

    async createProfile(blockchain, peerId) {
        return this.callImplementationFunction(blockchain, 'createProfile', [peerId]);
    }

    async getGasPrice(blockchain) {
        return this.callImplementationFunction(blockchain, 'getGasPrice');
    }

    async healthCheck(blockchain) {
        return this.callImplementationFunction(blockchain, 'healthCheck');
    }

    async restartService(blockchain) {
        return this.callImplementationFunction(blockchain, 'restartService');
    }

    async getKnowledgeCollectionMerkleRootByIndex(
        blockchain,
        assetStorageContractAddress,
        knowledgeCollectionId,
        index,
    ) {
        return this.callImplementationFunction(blockchain, 'getCollectionMerkleRootByIndex', [
            assetStorageContractAddress,
            knowledgeCollectionId,
            index,
        ]);
    }

    async getKnowledgeCollectionLatestMerkleRoot(
        blockchain,
        assetStorageContractAddress,
        knowledgeCollectionId,
    ) {
        return this.callImplementationFunction(
            blockchain,
            'getKnowledgeCollectionLatestMerkleRoot',
            [assetStorageContractAddress, knowledgeCollectionId],
        );
    }

    async getLatestKnowledgeCollectionId(blockchain, assetStorageContractAddress) {
        return this.callImplementationFunction(blockchain, 'getLatestKnowledgeCollectionId', [
            assetStorageContractAddress,
        ]);
    }

    getAssetStorageContractAddresses(blockchain) {
        return this.callImplementationFunction(blockchain, 'getAssetStorageContractAddresses');
    }

    async getKnowledgeCollectionMerkleRoots(
        blockchain,
        assetStorageContractAddress,
        knowledgeCollectionId,
    ) {
        return this.callImplementationFunction(blockchain, 'getKnowledgeCollectionMerkleRoots', [
            assetStorageContractAddress,
            knowledgeCollectionId,
        ]);
    }

    // async getKnowledgeAssetOwner(blockchain, assetContractAddress, tokenId) {
    //     return this.callImplementationFunction(blockchain, 'getKnowledgeAssetOwner', [
    //         assetContractAddress,
    //         tokenId,
    //     ]);
    // }

    async getShardingTableHead(blockchain) {
        return this.callImplementationFunction(blockchain, 'getShardingTableHead');
    }

    async getShardingTableLength(blockchain) {
        return this.callImplementationFunction(blockchain, 'getShardingTableLength');
    }

    async getShardingTablePage(blockchain, startingIdentityId, nodesNum) {
        return this.callImplementationFunction(blockchain, 'getShardingTablePage', [
            startingIdentityId,
            nodesNum,
        ]);
    }

    async getKnowledgeCollectionSize(blockchain, knowledgeCollectionId) {
        return this.callImplementationFunction(blockchain, 'getKnowledgeCollectionSize', [
            knowledgeCollectionId,
        ]);
    }

    // async getAssertionTriplesNumber(blockchain, assertionid) {
    //     return this.callImplementationFunction(blockchain, 'getAssertionTriplesNumber', [
    //         assertionid,
    //     ]);
    // }

    // async getAssertionChunksNumber(blockchain, assertionid) {
    //     return this.callImplementationFunction(blockchain, 'getAssertionChunksNumber', [
    //         assertionid,
    //     ]);
    // }

    async getParanetKnowledgeAssetsCount(blockchain, paranetId) {
        return this.callImplementationFunction(blockchain, 'getParanetKnowledgeAssetsCount', [
            paranetId,
        ]);
    }

    async getParanetKnowledgeAssetsWithPagination(blockchain, paranetId, offset, limit) {
        return this.callImplementationFunction(
            blockchain,
            'getParanetKnowledgeAssetsWithPagination',
            [paranetId, offset, limit],
        );
    }

    async getMinimumStake(blockchain) {
        return this.callImplementationFunction(blockchain, 'getMinimumStake');
    }

    async getMaximumStake(blockchain) {
        return this.callImplementationFunction(blockchain, 'getMaximumStake');
    }

    async getLatestBlock(blockchain) {
        return this.callImplementationFunction(blockchain, 'getLatestBlock');
    }

    async getBlockchainTimestamp(blockchain) {
        return this.callImplementationFunction(blockchain, 'getBlockchainTimestamp');
    }

    async getParanetMetadata(blockchain, paranetId) {
        return this.callImplementationFunction(blockchain, 'getParanetMetadata', [paranetId]);
    }

    async getParanetName(blockchain, paranetId) {
        return this.callImplementationFunction(blockchain, 'getName', [paranetId]);
    }

    async getDescription(blockchain, paranetId) {
        return this.callImplementationFunction(blockchain, 'getDescription', [paranetId]);
    }

    async getParanetKnowledgeAssetLocator(blockchain, knowledgeAssetId) {
        return this.callImplementationFunction(blockchain, 'getParanetKnowledgeAssetLocator', [
            knowledgeAssetId,
        ]);
    }

    async paranetExists(blockchain, paranetId) {
        return this.callImplementationFunction(blockchain, 'paranetExists', [paranetId]);
    }

    async isCuratedNode(blockchain, paranetId, identityId) {
        return this.callImplementationFunction(blockchain, 'isCuratedNode', [
            paranetId,
            identityId,
        ]);
    }

    async getNodesAccessPolicy(blockchain, paranetId) {
        return this.callImplementationFunction(blockchain, 'getNodesAccessPolicy', [paranetId]);
    }

    async getParanetCuratedNodes(blockchain, paranetId) {
        return this.callImplementationFunction(blockchain, 'getParanetCuratedNodes', [paranetId]);
    }

    async getNodeId(blockchain, identityId) {
        return this.callImplementationFunction(blockchain, 'getNodeId', [identityId]);
    }
}

export default BlockchainModuleManager;
