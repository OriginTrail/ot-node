import NetworkProtocolCommand from '../../common/network-protocol-command.js';
import { ERROR_TYPE } from '../../../../constants/constants.js';

class NetworkUpdateCommand extends NetworkProtocolCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.updateService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.ualService = ctx.ualService;

        this.errorType = ERROR_TYPE.UPDATE.UPDATE_START_ERROR;
    }

    async getKeywords(command) {
        const { blockchain, contract, tokenId } = command.data;
        const locationKeyword = await this.ualService.calculateLocationKeyword(
            blockchain,
            contract,
            tokenId,
            0,
        );

        return [locationKeyword];
    }

    async getBatchSize(blockchainId) {
        return this.blockchainModuleManager.getR2(blockchainId);
    }

    async getMinAckResponses(blockchainId) {
        return this.blockchainModuleManager.getR1(blockchainId);
    }

    /**
     * Builds default NetworkUpdateCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'networkUpdateCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default NetworkUpdateCommand;
