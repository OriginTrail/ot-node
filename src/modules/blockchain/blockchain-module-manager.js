import BaseModuleManager from '../base-module-manager.js';

class BlockchainModuleManager extends BaseModuleManager {
    getName() {
        return 'blockchain';
    }

    async initializeContracts(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.initializeContracts();
        }
    }

    async increaseGanacheTime(blockchain, seconds) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.increaseGanacheTime(seconds);
        }
    }

    getPrivateKey(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getPrivateKey();
        }
    }

    getPublicKey(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getPublicKey();
        }
    }

    getManagementKey(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getManagementKey();
        }
    }

    async getIdentityId(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getIdentityId();
        }
    }

    async identityIdExists(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.identityIdExists();
        }
    }

    async createProfile(blockchain, peerId) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.createProfile(peerId);
        }
    }

    async healthCheck(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.healthCheck();
        }
    }

    async restartService(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.restartService();
        }
    }

    async getAssertionByIndex(blockchain, assetContractAddress, tokenId, index) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getAssertionByIndex(
                assetContractAddress,
                tokenId,
                index,
            );
        }
    }

    async getLatestAssertion(blockchain, assetContractAddress, tokenId) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getLatestAssertion(
                assetContractAddress,
                tokenId,
            );
        }
    }

    async getAssertionIssuer(blockchain, assertionId) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getAssertionIssuer(assertionId);
        }
    }

    async getShardingTableHead(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getShardingTableHead();
        }
    }

    async getShardingTableLength(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getShardingTableLength();
        }
    }

    async getShardingTablePage(blockchain, startingPeerId, nodesNum) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getShardingTablePage(
                startingPeerId,
                nodesNum,
            );
        }
    }

    async getAllPastEvents(
        contractName,
        onEventsReceived,
        getLastCheckedBlock,
        updateLastCheckedBlock,
    ) {
        const blockchainIds = this.getImplementationNames();
        const getEventsPromises = [];
        for (const blockchainId of blockchainIds) {
            getEventsPromises.push(
                this.getImplementation(blockchainId).module.getAllPastEvents(
                    contractName,
                    onEventsReceived,
                    getLastCheckedBlock,
                    updateLastCheckedBlock,
                ),
            );
        }
        return Promise.all(getEventsPromises);
    }

    convertAsciiToHex(blockchain, peerId) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.convertAsciiToHex(peerId);
        }
    }

    convertHexToAscii(blockchain, peerIdHex) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.convertHexToAscii(peerIdHex);
        }
    }

    convertToWei(blockchain, ether, fromUnit) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.convertToWei(ether, fromUnit);
        }
    }

    async isCommitWindowOpen(blockchain, agreementId, epoch) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.isCommitWindowOpen(agreementId, epoch);
        }
    }

    async getCommitSubmissions(blockchain, agreementId, epoch) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getCommitSubmissions(
                agreementId,
                epoch,
            );
        }
    }

    async getAgreementData(blockchain, agreementId) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getAgreementData(agreementId);
        }
    }

    async getAssertionSize(blockchain, assertionid) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getAssertionSize(assertionid);
        }
    }

    async getAssertionTriplesNumber(blockchain, assertionid) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getAssertionTriplesNumber(assertionid);
        }
    }

    async getAssertionChunksNumber(blockchain, assertionid) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getAssertionChunksNumber(assertionid);
        }
    }

    async submitCommit(blockchain, assetContractAddress, tokenId, keyword, hashFunctionId, epoch) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.submitCommit(
                assetContractAddress,
                tokenId,
                keyword,
                hashFunctionId,
                epoch,
            );
        }
    }

    async isProofWindowOpen(blockchain, agreementId, epoch) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.isProofWindowOpen(agreementId, epoch);
        }
    }

    async getChallenge(blockchain, assetContractAddress, tokenId, epoch) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getChallenge(
                assetContractAddress,
                tokenId,
                epoch,
            );
        }
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
            );
        }
    }

    async getHashFunctionName(blockchain, hashFunctionId) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getHashFunctionName(hashFunctionId);
        }
    }

    async callHashFunction(blockchain, hashFunctionId, data) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.callHashFunction(hashFunctionId, data);
        }
    }

    async getR2(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getR2();
        }
    }

    async getR1(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getR1();
        }
    }

    async getR0(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getR0();
        }
    }

    async getCommitWindowDuration(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getCommitWindowDuration();
        }
    }

    async getProofWindowDurationPerc(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getProofWindowDurationPerc();
        }
    }

    async getLog2PLDSFParams(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getLog2PLDSFParams();
        }
    }
}

export default BlockchainModuleManager;
