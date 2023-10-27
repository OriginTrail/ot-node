import { assertionMetadata } from 'assertion-tools';
import { BYTES_IN_KILOBYTE } from '../constants/constants.js';

class ValidationService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.validationModuleManager = ctx.validationModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    async validateUal(blockchain, contract, tokenId) {
        this.logger.info(
            `Validating the UAL: did:dkg:${blockchain.toLowerCase()}/${contract.toLowerCase()}/${tokenId}.`,
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
        this.logger.info(`Validating Assertion with the ID: ${assertionId}.`);

        this.validateAssertionId(blockchain, assertionId, assertion);

        // TODO: get assertion data in one call
        await this.validateAssertionSize(blockchain, assertionId, assertion);
        await this.validateTriplesNumber(blockchain, assertionId, assertion);
        await this.validateChunkSize(blockchain, assertionId, assertion);

        this.logger.info(`Assertion integrity has been validated!`);
    }

    async validateAssertionSize(blockchain, assertionId, assertion) {
        const blockchainAssertionSize = await this.blockchainModuleManager.getAssertionSize(
            blockchain,
            assertionId,
        );

        const blockchainAssertionSizeInKb = blockchainAssertionSize / BYTES_IN_KILOBYTE;
        if (blockchainAssertionSizeInKb > this.config.maximumAssertionSizeInKb) {
            throw Error(
                `The size of the received assertion exceeds the maximum limit allowed. ` +
                    `Maximum allowed Assertion Size in KB: ${this.config.maximumAssertionSizeInKb}. ` +
                    `Assertion Size read from the Blockchain: ${blockchain} in KB: ${blockchainAssertionSizeInKb}.`,
            );
        }
        const assertionSize = assertionMetadata.getAssertionSizeInBytes(assertion);
        if (blockchainAssertionSize !== assertionSize) {
            // todo after corrective component is implemented, update this logic
            this.logger.warn(
                `Invalid Assertion Size. Calculated Assertion Size in KB: ${assertionSize}. ` +
                    `Value read from the Blockchain (${blockchain}) in KB: ${blockchainAssertionSize}.`,
            );
        }
    }

    async validateTriplesNumber(blockchain, assertionId, assertion) {
        const blockchainTriplesNumber =
            await this.blockchainModuleManager.getAssertionTriplesNumber(blockchain, assertionId);
        const triplesNumber = assertionMetadata.getAssertionTriplesNumber(assertion);
        if (blockchainTriplesNumber !== triplesNumber) {
            throw Error(
                `Invalid triples number. Calculated Assertion Triples Number: ${triplesNumber}. ` +
                    `Value read from the Blockchain (${blockchain}): ${blockchainTriplesNumber}.`,
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
                `Invalid chunks number. Calculated Assertion Chunks Number: ${chunksNumber}. ` +
                    `Value read from the Blockchain (${blockchain}): ${blockchainChunksNumber}.`,
            );
        }
    }

    validateAssertionId(blockchain, assertionId, assertion) {
        const calculatedAssertionId = this.validationModuleManager.calculateRoot(assertion);

        if (assertionId !== calculatedAssertionId) {
            // todo after corrective component is implemented, update this logic
            this.logger.warn(
                `Invalid Assertion ID. Calculated Assertion ID: ${calculatedAssertionId}. ` +
                    `Value read from the Blockchain (${blockchain}): ${assertionId}.`,
            );
        }
    }
}

export default ValidationService;
