import BaseModuleManager from '../base-module-manager.js';

class BlockchainModuleManager extends BaseModuleManager {
    getName() {
        return 'blockchain';
    }

    async initializeContracts(blockchain) {
        return this.callImplementationFunction(blockchain, 'initializeContracts');
    }

    getPrivateKey(blockchain) {
        return this.callImplementationFunction(blockchain, 'getPrivateKey');
    }

    getPublicKey(blockchain) {
        return this.callImplementationFunction(blockchain, 'getPublicKey');
    }

    getManagementKey(blockchain) {
        return this.callImplementationFunction(blockchain, 'getManagementKey');
    }

    async isHubContract(blockchain, contractAddress) {
        return this.callImplementationFunction(blockchain, 'isHubContract', [contractAddress]);
    }

    async isAssetStorageContract(blockchain, contractAddress) {
        return this.callImplementationFunction(blockchain, 'isAssetStorageContract', [
            contractAddress,
        ]);
    }

    async getNodeStake(blockchain, identityId) {
        return this.callImplementationFunction(blockchain, 'getNodeStake', [identityId]);
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

    async healthCheck(blockchain) {
        return this.callImplementationFunction(blockchain, 'healthCheck');
    }

    async restartService(blockchain) {
        return this.callImplementationFunction(blockchain, 'restartService');
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

    async getUnfinalizedAssertionId(blockchain, tokenId) {
        return this.callImplementationFunction(blockchain, 'getUnfinalizedState', [
            tokenId,
        ]);
    }

    async getAssertionIssuer(blockchain, assertionId) {
        return this.callImplementationFunction(blockchain, 'getAssertionIssuer', [assertionId]);
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

    async getAllPastEvents(
        blockchain,
        contractName,
        lastCheckedBlock,
        lastCheckedTimestamp,
        currentBlock,
    ) {
        return this.callImplementationFunction(blockchain, 'getAllPastEvents', [
            blockchain,
            contractName,
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

    async isCommitWindowOpen(blockchain, agreementId, epoch) {
        return this.callImplementationFunction(blockchain, 'isCommitWindowOpen', [
            agreementId,
            epoch,
        ]);
    }

    async getTopCommitSubmissions(blockchain, agreementId, epoch, assertionId) {
        return this.callImplementationFunction(blockchain, 'getTopCommitSubmissions', [
            agreementId,
            epoch,
            assertionId,
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

    async submitCommit(
        blockchain,
        assetContractAddress,
        tokenId,
        keyword,
        hashFunctionId,
        epoch,
        callback,
    ) {
        return this.callImplementationFunction(blockchain, 'submitCommit', [
            assetContractAddress,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
            callback,
        ]);
    }

    async isProofWindowOpen(blockchain, agreementId, epoch) {
        return this.callImplementationFunction(blockchain, 'isProofWindowOpen', [
            agreementId,
            epoch,
        ]);
    }

    async getChallenge(blockchain, assetContractAddress, tokenId, epoch) {
        return this.callImplementationFunction(blockchain, 'getChallenge', [
            assetContractAddress,
            tokenId,
            epoch,
        ]);
    }

    async sendProof(
        blockchain,
        assetContractAddress,
        tokenId,
        keyword,
        hashFunctionId,
        epoch,
        proof,
        chunkHash,
        callback,
    ) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.sendProof(
                assetContractAddress,
                tokenId,
                keyword,
                hashFunctionId,
                epoch,
                proof,
                chunkHash,
                callback,
            );
        }
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

    async getCommitWindowDurationPerc(blockchain) {
        return this.callImplementationFunction(blockchain, 'getCommitWindowDurationPerc');
    }

    async getProofWindowDurationPerc(blockchain) {
        return this.callImplementationFunction(blockchain, 'getProofWindowDurationPerc');
    }

    async isHashFunction(blockchain, hashFunctionId) {
        return this.callImplementationFunction(blockchain, 'isHashFunction', [hashFunctionId]);
    }

    async isScoreFunction(blockchain, scoreFunctionId) {
        return this.callImplementationFunction(blockchain, 'isScoreFunction', [scoreFunctionId]);
    }

    async callScoreFunction(blockchain, scoreFunctionId, hashFunctionId, peerId, keyword, stake) {
        return this.callImplementationFunction(blockchain, 'callScoreFunction', [
            scoreFunctionId,
            hashFunctionId,
            peerId,
            keyword,
            stake,
        ]);
    }

    async getLog2PLDSFParams(blockchain) {
        return this.callImplementationFunction(blockchain, 'getLog2PLDSFParams');
    }

    callImplementationFunction(blockchain, functionName, args = []) {
        if (blockchain) {
            const split = blockchain.split(':');
            const [name] = split;
            if (this.getImplementation(name)) {
                return this.getImplementation(name).module[functionName](...args);
            }
        } else {
            return this.getImplementation().module[functionName](...args);
        }
    }
}

export default BlockchainModuleManager;
