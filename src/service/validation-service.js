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

    async validateAssertion(assertionMerkleRoot, blockchain, assertion) {
        this.logger.info(`Validating assertionMerkleRoot: ${assertionMerkleRoot}`);

        await this.validateAssertionMerkleRoot(assertion, assertionMerkleRoot);

        this.logger.info(
            `Assertion integrity validated! assertionMerkleRoot: ${assertionMerkleRoot}`,
        );
    }

    async validateAssertionMerkleRootOnBlockchain(
        knowledgeCollectionId,
        assertionMerkleRoot,
        blockchain,
    ) {
        // call contract TO DO, dont return anything or return true
        return { knowledgeCollectionId, assertionMerkleRoot, blockchain };
    }

    async validateAssertionOnBlockchain(knowledgeCollectionId, assertion, blockchain) {
        const assertionMerkleRoot = await this.validationModuleManager.calculateRoot(assertion);

        await this.validateAssertionMerkleRootOnBlockchain(
            knowledgeCollectionId,
            assertionMerkleRoot,
            blockchain,
        );
    }

    async validateAssertionMerkleRoot(assertion, assertionMerkleRoot) {
        const calculatedassertionMerkleRoot = await this.validationModuleManager.calculateRoot(
            assertion,
        );

        if (assertionMerkleRoot !== calculatedassertionMerkleRoot) {
            throw new Error(
                `Merkle Root validation failed. Received Merkle Root: ${assertionMerkleRoot}; Calculated Merkle Root: ${calculatedassertionMerkleRoot}`,
            );
        }
    }
}

export default ValidationService;
