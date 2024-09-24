import ProtocolInitCommand from '../../../common/protocol-init-command.js';
import { NETWORK_MESSAGE_TIMEOUT_MILLS, ERROR_TYPE } from '../../../../../constants/constants.js';

class UpdateParanetInitCommand extends ProtocolInitCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.updateParanetService;

        this.errorType = ERROR_TYPE.UPDATE_PARANET.UPDATE_PARANET_STORE_INIT_ERROR;
    }

    async prepareMessage(command) {
        const { assertions, contract, tokenId, keyword, hashFunctionId } = command.data;
        const publicAssertionId = assertions[0]?.assertionId;
        const privateAssertionId = assertions[0]?.assertionId;
        const proximityScoreFunctionsPairId = command.data.proximityScoreFunctionsPairId ?? 1;

        // TODO: Backwards compatibility, send blockchain without chainId
        const blockchain = command.data.blockchain.split(':')[0];

        return {
            publicAssertionId,
            privateAssertionId,
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            proximityScoreFunctionsPairId,
        };
    }

    messageTimeout() {
        return NETWORK_MESSAGE_TIMEOUT_MILLS.UPDATE.INIT;
    }

    /**
     * Builds default v1_0_0UpdateParanetInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0UpdateParanetInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default UpdateParanetInitCommand;
