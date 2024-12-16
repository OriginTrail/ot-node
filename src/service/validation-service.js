import { ZERO_ADDRESS } from '../constants/constants.js';

class ValidationService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.validationModuleManager = ctx.validationModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    async validateUal(blockchain, contract, tokenId) {
        this.logger.info(
            `Validating UAL: did:dkg:${blockchain.toLowerCase()}/${contract.toLowerCase()}/${tokenId}`,
        );

        let isValid = true;
        try {
            const result = await this.blockchainModuleManager.getKnowledgeCollectionPublisher(
                blockchain,
                contract,
                tokenId,
            );
            if (!result || result === ZERO_ADDRESS) {
                isValid = false;
            }
        } catch (err) {
            isValid = false;
        }

        return isValid;
    }

    async validateAssertion(assertionId, blockchain, assertion) {
        this.logger.info(`Validating assertionId: ${assertionId}`);

        await this.validateDatasetRoot(assertion, assertionId);

        this.logger.info(`Assertion integrity validated! AssertionId: ${assertionId}`);
    }

    async validateDatasetRootOnBlockchain(
        assertionId,
        blockchain,
        assetStorageContractAddress,
        knowledgeCollectionId,
    ) {
        const blockchainAssertionRoot =
            await this.blockchainModuleManager.getKnowledgeCollectionLatestMerkleRoot(
                blockchain,
                assetStorageContractAddress,
                knowledgeCollectionId,
            );

        return assertionId === blockchainAssertionRoot;
    }

    // Used to validate assertion node received through network get
    async validateDatasetOnBlockchain(
        assertion,
        blockchain,
        assetStorageContractAddress,
        knowledgeCollectionId,
    ) {
        const assertionId = await this.validationModuleManager.calculateRoot(assertion);

        return this.validateDatasetRootOnBlockchain(
            assertionId,
            blockchain,
            assetStorageContractAddress,
            knowledgeCollectionId,
        );
    }

    async validateDatasetRoot(dataset, datasetRoot) {
        const calculatedDatasetRoot = await this.validationModuleManager.calculateRoot(dataset);

        if (datasetRoot !== calculatedDatasetRoot) {
            throw new Error(
                `Merkle Root validation failed. Received Merkle Root: ${datasetRoot}; Calculated Merkle Root: ${calculatedDatasetRoot}`,
            );
        }
    }
}

export default ValidationService;
