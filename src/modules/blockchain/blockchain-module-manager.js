import BaseModuleManager from '../base-module-manager.js';

class BlockchainModuleManager extends BaseModuleManager {
    getName() {
        return 'blockchain';
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

    async getIdentityContractAddress(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getIdentityContractAddress();
        }
    }

    async profileExists(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.profileExists();
        }
    }

    async createProfile(blockchain, peerId) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.createProfile(peerId);
        }
    }

    async getBlockNumber(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getBlockNumber();
        }
    }

    getBlockTime(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getBlockTime();
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

    async getShardingTableFull(blockchain) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getShardingTableFull();
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

    async getServiceAgreement(blockchain, agreementId) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getServiceAgreement(agreementId);
        }
    }

    async submitCommit(
        blockchain,
        assetContractAddress,
        tokenId,
        keyword,
        hashingAlgorithm,
        epoch,
        prevIdentityId,
    ) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.submitCommit(
                assetContractAddress,
                tokenId,
                keyword,
                hashingAlgorithm,
                epoch,
                prevIdentityId,
            );
        }
    }

    async isProofWindowOpen(blockchain, agreementId, epoch) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.isProofWindowOpen(agreementId, epoch);
        }
    }

    async getChallenge(blockchain, assetContractAddress, tokenId, keyword, hashingAlgorithm) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.getChallenge(
                assetContractAddress,
                tokenId,
                keyword,
                hashingAlgorithm,
            );
        }
    }

    async sendProof(
        blockchain,
        assetContractAddress,
        tokenId,
        keyword,
        hashingAlgorithm,
        epoch,
        proof,
        chunkHash,
    ) {
        if (this.getImplementation(blockchain)) {
            return this.getImplementation(blockchain).module.sendProof(
                assetContractAddress,
                tokenId,
                keyword,
                hashingAlgorithm,
                epoch,
                proof,
                chunkHash,
            );
        }
    }
}

export default BlockchainModuleManager;
