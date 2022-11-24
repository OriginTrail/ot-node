import NetworkProtocolCommand from '../../common/network-protocol-command.js';
import { ERROR_TYPE } from '../../../../constants/constants.js';

class NetworkPublishCommand extends NetworkProtocolCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.ualService = ctx.ualService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_START_ERROR;
    }

    async getKeywords(command) {
        const { blockchain, contract, tokenId } = command.data;
        const locationHash = await this.ualService.calculateLocationHash(
            blockchain,
            contract,
            tokenId,
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
