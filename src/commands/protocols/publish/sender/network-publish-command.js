import NetworkProtocolCommand from '../../common/network-protocol-command.js';
import { ERROR_TYPE } from '../../../../constants/constants.js';

class NetworkPublishCommand extends NetworkProtocolCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.ualService = ctx.ualService;
        this.validationModuleManager = ctx.validationModuleManager;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_START_ERROR;
    }

    // TODO: discuss if we want to change to Hash(contract/tokenId/aId1) for the locationHash
    async getKeywords(command) {
        const { blockchain, contract, tokenId } = command.data;
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
        const firstAssertionId = await this.blockchainModuleManager.getAssertionByIndex(
            blockchain,
            contract,
            tokenId,
            0,
        );
        const locationHash = await this.validationModuleManager.callHashFunction(
            0,
            `${ual}/${firstAssertionId}`,
        );

        return [locationHash];
    }

    async getBatchSize(blockchainId) {
        return this.blockchainModuleManager.getR2(blockchainId);
    }

    async getMinAckResponses(blockchainId) {
        return this.blockchainModuleManager.getR1(blockchainId);
    }

    /**
     * Builds default networkPublishCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'networkPublishCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default NetworkPublishCommand;
