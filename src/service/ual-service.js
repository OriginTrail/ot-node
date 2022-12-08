/* eslint-disable no-restricted-globals */
import { ethers } from 'ethers';

class UALService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;

        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.validationModuleManager = ctx.validationModuleManager;
    }

    deriveUAL(blockchain, contract, tokenId) {
        return `did:dkg:${blockchain.toLowerCase()}/${contract.toLowerCase()}/${tokenId}`;
    }

    // did:dkg:otp:2043/0x123231/5
    isUAL(ual) {
        const segments = ual.split(':');
        if (segments?.length !== 4) return false;

        const argsString = segments[2] + segments[3];
        const args = argsString.split('/');
        if (args?.length !== 3) return false;

        return !isNaN(argsString[2]);
    }

    resolveUAL(ual) {
        const segments = ual.split(':');
        const argsString = segments[2] + segments[3];
        const args = argsString.split('/');

        if (segments.length !== 4 || args.length !== 3 || isNaN(args[2])) {
            throw new Error(`UAL doesn't have correct format: ${ual}`);
        }

        return {
            blockchain: args[0],
            contract: args[1],
            tokenId: args[2],
        };
    }

    async calculateLocationKeyword(blockchain, contract, tokenId, index) {
        const firstAssertionId = await this.blockchainModuleManager.getAssertionIdByIndex(
            blockchain,
            contract,
            tokenId,
            index,
        );
        return ethers.utils.solidityPack(['address', 'bytes32'], [contract, firstAssertionId]);
    }
}

export default UALService;
