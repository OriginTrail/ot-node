import ProtocolInitCommand from '../../../common/protocol-init-command.js';
import { NETWORK_MESSAGE_TIMEOUT_MILLS, ERROR_TYPE } from '../../../../../constants/constants.js';

class GetInitCommand extends ProtocolInitCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.getService;

        this.errorType = ERROR_TYPE.GET.GET_INIT_ERROR;
    }

    async prepareMessage(command) {
        const { contract, tokenId, keyword, assertionId, state } = command.data;
        const proximityScoreFunctionsPairId = command.data.proximityScoreFunctionsPairId ?? 1;
        // TODO: Backwards compatibility, send blockchain without chainId
        const blockchain = command.data.blockchain.split(':')[0];

        return {
            blockchain,
            contract,
            tokenId,
            keyword,
            assertionId,
            state,
            proximityScoreFunctionsPairId,
        };
    }

    messageTimeout() {
        return NETWORK_MESSAGE_TIMEOUT_MILLS.GET.INIT;
    }

    /**
     * Builds default getInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0GetInitCommand',
            delay: 0,
            retries: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default GetInitCommand;
