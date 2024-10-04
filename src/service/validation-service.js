import { assertionMetadata } from 'assertion-tools';
import { BYTES_IN_KILOBYTE, EVM_ZERO } from '../constants/constants.js';

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
            const result = await this.blockchainModuleManager.getKnowledgeAssetOwner(
                blockchain,
                contract,
                tokenId,
            );
            if (!result || result === EVM_ZERO.ADDRESS) {
                isValid = false;
            }
        } catch (err) {
            isValid = false;
        }

        return isValid;
    }

    async validateAssertion(assertionId, blockchain, assertion) {
        this.logger.info(`Validating assertionId: ${assertionId}`);

        this.validateAssertionId(assertion, assertionId);
        const blockchainAssertionData = await this.blockchainModuleManager.getAssertionData(
            blockchain,
            assertionId,
        );
        this.validateAssertionSize(blockchainAssertionData.size, assertion);
        this.validateTriplesNumber(blockchainAssertionData.triplesNumber, assertion);
        this.validateChunkSize(blockchainAssertionData.chunksNumber, assertion);

        this.logger.info(`Assertion integrity validated! AssertionId: ${assertionId}`);
    }

    validateAssertionSize(blockchainAssertionSize, assertion) {
        const blockchainAssertionSizeInKb = blockchainAssertionSize / BYTES_IN_KILOBYTE;
        if (blockchainAssertionSizeInKb > this.config.maximumAssertionSizeInKb) {
            throw Error(
                `The size of the received assertion exceeds the maximum limit allowed.. Maximum allowed assertion size in kb: ${this.config.maximumAssertionSizeInKb}, assertion size read from blockchain in kb: ${blockchainAssertionSizeInKb}`,
            );
        }
        const assertionSize = assertionMetadata.getAssertionSizeInBytes(assertion);
        if (blockchainAssertionSize !== assertionSize) {
            // todo after corrective component is implemented, update this logic
            this.logger.warn(
                `Invalid assertion size, value read from blockchain: ${blockchainAssertionSize}, calculated: ${assertionSize}`,
            );
        }
    }

    validateTriplesNumber(blockchainTriplesNumber, assertion) {
        const triplesNumber = assertionMetadata.getAssertionTriplesNumber(assertion);
        if (blockchainTriplesNumber !== triplesNumber) {
            throw Error(
                `Invalid triples number, value read from blockchain: ${blockchainTriplesNumber}, calculated: ${triplesNumber}`,
            );
        }
    }

    validateChunkSize(blockchainChunksNumber, assertion) {
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
            // todo after corrective component is implemented, update this logic
            this.logger.warn(
                `Invalid assertion id. Received value: ${assertionId}, calculated: ${calculatedAssertionId}`,
            );
        }
    }
}

export default ValidationService;
