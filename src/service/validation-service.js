import { assertionMetadata } from 'assertion-tools';

class ValidationService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.validationModuleManager = ctx.validationModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    async validateUal(blockchain, contract, tokenId) {
        this.logger.info(
            `Validating UAL: did:dkg:${blockchain.toLowerCase()}/${contract.toLowerCase()}/${tokenId}`,
        );

        let isValid = true;
        try {
            await this.blockchainModuleManager.getKnowledgeAssetOwner(
                blockchain,
                contract,
                tokenId,
            );
        } catch (err) {
            isValid = false;
        }

        return isValid;
    }

    async validateAssertion(assertionId, blockchain, assertion) {
        this.logger.info(`Validating assertionId: ${assertionId}`);

        this.validateAssertionId(assertion, assertionId);

        // TODO: get assertion data in one call

        await this.validateAssertionSize(blockchain, assertionId, assertion);
        await this.validateTriplesNumber(blockchain, assertionId, assertion);
        await this.validateChunkSize(blockchain, assertionId, assertion);

        this.logger.info(`Assertion integrity validated!`);
    }

    async validateAssertionSize(blockchain, assertionId, assertion) {
        const blockchainAssertionSize = await this.blockchainModuleManager.getAssertionSize(
            blockchain,
            assertionId,
        );
        const assertionSize = assertionMetadata.getAssertionSizeInBytes(assertion);
        if (blockchainAssertionSize !== assertionSize) {
            throw Error(
                `Invalid assertion size, value read from blockchain: ${blockchainAssertionSize}, calculated: ${assertionSize}`,
            );
        }
    }

    async validateTriplesNumber(blockchain, assertionId, assertion) {
        const blockchainTriplesNumber =
            await this.blockchainModuleManager.getAssertionTriplesNumber(blockchain, assertionId);
        const triplesNumber = assertionMetadata.getAssertionTriplesNumber(assertion);
        if (blockchainTriplesNumber !== triplesNumber) {
            throw Error(
                `Invalid triples number, value read from blockchain: ${blockchainTriplesNumber}, calculated: ${triplesNumber}`,
            );
        }
    }

    async validateChunkSize(blockchain, assertionId, assertion) {
        const blockchainChunksNumber = await this.blockchainModuleManager.getAssertionChunksNumber(
            blockchain,
            assertionId,
        );
        const chunksNumber = assertionMetadata.getAssertionChunksNumber(assertion);
        if (blockchainChunksNumber !== chunksNumber) {
            throw Error(
                `Invalid chunks number, value read from blockchain: ${blockchainChunksNumber}, calculated size: ${chunksNumber}`,
            );
        }
    }

    validateAssertionId(assertion, assertionId) {
        const calculatedAssertionId = this.validationModuleManager.calculateRoot(assertion);

        if (assertionId !== calculatedAssertionId) {
            throw Error(
                `Invalid assertion id. Received value: ${assertionId}, calculated: ${calculatedAssertionId}`,
            );
        }
    }
}

export default ValidationService;
