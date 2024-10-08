import BaseModuleManager from '../base-module-manager.js';

class BlockchainModuleManager extends BaseModuleManager {
    getName() {
        return 'blockchain';
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

    async getMinProofWindowOffsetPerc(blockchain) {
        return this.callImplementationFunction(blockchain, 'getMinProofWindowOffsetPerc');
    }

    async getMaxProofWindowOffsetPerc(blockchain) {
        return this.callImplementationFunction(blockchain, 'getMaxProofWindowOffsetPerc');
    }

    async generatePseudorandomUint8(blockchain, assetCreator, blockNumber, blockTimestamp, limit) {
        return this.callImplementationFunction(blockchain, 'generatePseudorandomUint8', [
            assetCreator,
            blockNumber,
            blockTimestamp,
            limit,
        ]);
    }

    async getAssertionIdByIndex(blockchain, assetContractAddress, tokenId, index) {
        return this.callImplementationFunction(blockchain, 'getAssertionIdByIndex', [
            assetContractAddress,
            tokenId,
            index,
        ]);
    }

    async getLatestAssertionId(blockchain, assetContractAddress, tokenId) {
        return this.callImplementationFunction(blockchain, 'getLatestAssertionId', [
            assetContractAddress,
            tokenId,
        ]);
    }

    async getLatestTokenId(blockchain, assetContractAddress) {
        return this.callImplementationFunction(blockchain, 'getLatestTokenId', [
            assetContractAddress,
        ]);
    }

    getAssetStorageContractAddresses(blockchain) {
        return this.callImplementationFunction(blockchain, 'getAssetStorageContractAddresses');
    }

    async getAssertionIds(blockchain, assetContractAddress, tokenId) {
        return this.callImplementationFunction(blockchain, 'getAssertionIds', [
            assetContractAddress,
            tokenId,
        ]);
    }

    async getKnowledgeAssetOwner(blockchain, assetContractAddress, tokenId) {
        return this.callImplementationFunction(blockchain, 'getKnowledgeAssetOwner', [
            assetContractAddress,
            tokenId,
        ]);
    }

    async getUnfinalizedAssertionId(blockchain, tokenId) {
        return this.callImplementationFunction(blockchain, 'getUnfinalizedState', [tokenId]);
    }

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

    async getTransaction(blockchain, transactionHash) {
        return this.callImplementationFunction(blockchain, 'getTransaction', [transactionHash]);
    }

    async getAllPastEvents(
        blockchain,
        contractName,
        eventsToFilter,
        lastCheckedBlock,
        lastCheckedTimestamp,
        currentBlock,
    ) {
        return this.callImplementationFunction(blockchain, 'getAllPastEvents', [
            blockchain,
            contractName,
            eventsToFilter,
            lastCheckedBlock,
            lastCheckedTimestamp,
            currentBlock,
        ]);
    }

    toBigNumber(blockchain, value) {
        return this.callImplementationFunction(blockchain, 'toBigNumber', [value]);
    }

    keccak256(blockchain, bytesLikeData) {
        return this.callImplementationFunction(blockchain, 'keccak256', [bytesLikeData]);
    }

    sha256(blockchain, bytesLikeData) {
        return this.callImplementationFunction(blockchain, 'sha256', [bytesLikeData]);
    }

    encodePacked(blockchain, types, values) {
        return this.callImplementationFunction(blockchain, 'encodePacked', [types, values]);
    }

    convertAsciiToHex(blockchain, string) {
        return this.callImplementationFunction(blockchain, 'convertAsciiToHex', [string]);
    }

    convertHexToAscii(blockchain, hexString) {
        return this.callImplementationFunction(blockchain, 'convertHexToAscii', [hexString]);
    }

    convertBytesToUint8Array(blockchain, bytesLikeData) {
        return this.callImplementationFunction(blockchain, 'convertBytesToUint8Array', [
            bytesLikeData,
        ]);
    }

    convertToWei(blockchain, value, fromUnit) {
        return this.callImplementationFunction(blockchain, 'convertToWei', [value, fromUnit]);
    }

    convertFromWei(blockchain, value, toUnit) {
        return this.callImplementationFunction(blockchain, 'convertFromWei', [value, toUnit]);
    }

    async isCommitWindowOpen(blockchain, agreementId, epoch, stateIndex) {
        return this.callImplementationFunction(blockchain, 'isCommitWindowOpen', [
            agreementId,
            epoch,
            stateIndex,
        ]);
    }

    async isUpdateCommitWindowOpen(blockchain, agreementId, epoch, latestStateIndex) {
        return this.callImplementationFunction(blockchain, 'isUpdateCommitWindowOpen', [
            agreementId,
            epoch,
            latestStateIndex,
        ]);
    }

    async getTopCommitSubmissions(blockchain, agreementId, epoch, latestStateIndex) {
        return this.callImplementationFunction(blockchain, 'getTopCommitSubmissions', [
            agreementId,
            epoch,
            latestStateIndex,
        ]);
    }

    async getAgreementData(blockchain, agreementId) {
        return this.callImplementationFunction(blockchain, 'getAgreementData', [agreementId]);
    }

    async getAssertionSize(blockchain, assertionid) {
        return this.callImplementationFunction(blockchain, 'getAssertionSize', [assertionid]);
    }

    async getAssertionTriplesNumber(blockchain, assertionid) {
        return this.callImplementationFunction(blockchain, 'getAssertionTriplesNumber', [
            assertionid,
        ]);
    }

    async getAssertionChunksNumber(blockchain, assertionid) {
        return this.callImplementationFunction(blockchain, 'getAssertionChunksNumber', [
            assertionid,
        ]);
    }

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

    async getAssertionData(blockchain, assertionid) {
        return this.callImplementationFunction(blockchain, 'getAssertionData', [assertionid]);
    }

    submitCommit(
        blockchain,
        assetContractAddress,
        tokenId,
        keyword,
        hashFunctionId,
        closestNode,
        leftNeighborhoodEdge,
        rightNeighborhoodEdge,
        epoch,
        latestStateIndex,
        callback,
        gasPrice,
    ) {
        return this.callImplementationFunction(blockchain, 'submitCommit', [
            assetContractAddress,
            tokenId,
            keyword,
            hashFunctionId,
            closestNode,
            leftNeighborhoodEdge,
            rightNeighborhoodEdge,
            epoch,
            latestStateIndex,
            callback,
            gasPrice,
        ]);
    }

    submitUpdateCommit(
        blockchain,
        assetContractAddress,
        tokenId,
        keyword,
        hashFunctionId,
        closestNode,
        leftNeighborhoodEdge,
        rightNeighborhoodEdge,
        epoch,
        callback,
        gasPrice,
    ) {
        return this.callImplementationFunction(blockchain, 'submitUpdateCommit', [
            assetContractAddress,
            tokenId,
            keyword,
            hashFunctionId,
            closestNode,
            leftNeighborhoodEdge,
            rightNeighborhoodEdge,
            epoch,
            callback,
            gasPrice,
        ]);
    }

    async isProofWindowOpen(blockchain, agreementId, epoch, latestStateIndex) {
        return this.callImplementationFunction(blockchain, 'isProofWindowOpen', [
            agreementId,
            epoch,
            latestStateIndex,
        ]);
    }

    async getChallenge(blockchain, assetContractAddress, tokenId, epoch, latestStateIndex) {
        return this.callImplementationFunction(blockchain, 'getChallenge', [
            assetContractAddress,
            tokenId,
            epoch,
            latestStateIndex,
        ]);
    }

    sendProof(
        blockchain,
        assetContractAddress,
        tokenId,
        keyword,
        hashFunctionId,
        epoch,
        proof,
        chunkHash,
        latestStateIndex,
        callback,
        gasPrice,
    ) {
        return this.callImplementationFunction(blockchain, 'sendProof', [
            assetContractAddress,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
            proof,
            chunkHash,
            latestStateIndex,
            callback,
            gasPrice,
        ]);
    }

    async getMinimumStake(blockchain) {
        return this.callImplementationFunction(blockchain, 'getMinimumStake');
    }

    async getMaximumStake(blockchain) {
        return this.callImplementationFunction(blockchain, 'getMaximumStake');
    }

    async getR2(blockchain) {
        return this.callImplementationFunction(blockchain, 'getR2');
    }

    async getR1(blockchain) {
        return this.callImplementationFunction(blockchain, 'getR1');
    }

    async getR0(blockchain) {
        return this.callImplementationFunction(blockchain, 'getR0');
    }

    async getFinalizationCommitsNumber(blockchain) {
        return this.callImplementationFunction(blockchain, 'getFinalizationCommitsNumber');
    }

    async getUpdateCommitWindowDuration(blockchain) {
        return this.callImplementationFunction(blockchain, 'getUpdateCommitWindowDuration');
    }

    async getCommitWindowDurationPerc(blockchain) {
        return this.callImplementationFunction(blockchain, 'getCommitWindowDurationPerc');
    }

    async getEpochLength(blockchain) {
        return this.callImplementationFunction(blockchain, 'getEpochLength');
    }

    async getProofWindowDurationPerc(blockchain) {
        return this.callImplementationFunction(blockchain, 'getProofWindowDurationPerc');
    }

    async isHashFunction(blockchain, hashFunctionId) {
        return this.callImplementationFunction(blockchain, 'isHashFunction', [hashFunctionId]);
    }

    getScoreFunctionIds(blockchain) {
        return this.callImplementationFunction(blockchain, 'getScoreFunctionIds');
    }

    async getLog2PLDSFParams(blockchain) {
        return this.callImplementationFunction(blockchain, 'getLog2PLDSFParams');
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

    async getLatestBlock(blockchain) {
        return this.callImplementationFunction(blockchain, 'getLatestBlock');
    }

    async getBlockchainTimestamp(blockchain) {
        return this.callImplementationFunction(blockchain, 'getBlockchainTimestamp');
    }

    getBlockTimeMillis(blockchain) {
        return this.callImplementationFunction(blockchain, 'getBlockTimeMillis');
    }

    async hasPendingUpdate(blockchain, tokenId) {
        return this.callImplementationFunction(blockchain, 'hasPendingUpdate', [tokenId]);
    }

    async getAgreementScoreFunctionId(blockchain, agreementId) {
        return this.callImplementationFunction(blockchain, 'getAgreementScoreFunctionId', [
            agreementId,
        ]);
    }

    convertUint8ArrayToHex(blockchain, uint8Array) {
        return this.callImplementationFunction(blockchain, 'convertUint8ArrayToHex', [uint8Array]);
    }

    async getLinearSumParams(blockchain) {
        return this.callImplementationFunction(blockchain, 'getLinearSumParams');
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

    async getKnowledgeAssetLocatorFromParanetId(blockchain, paranetId) {
        return this.callImplementationFunction(
            blockchain,
            'getKnowledgeAssetLocatorFromParanetId',
            [paranetId],
        );
    }

    async paranetExists(blockchain, paranetId) {
        return this.callImplementationFunction(blockchain, 'paranetExists', [paranetId]);
    }

    async isParanetKnowledgeAsset(blockchain, knowledgeAssetId) {
        return this.callImplementationFunction(blockchain, 'isParanetKnowledgeAsset', [
            knowledgeAssetId,
        ]);
    }

    async getParanetId(blockchain, knowledgeAssetId) {
        return this.callImplementationFunction(blockchain, 'getParanetId', [knowledgeAssetId]);
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
