import ProtocolInitCommand from '../../../common/protocol-init-command.js';
import { NETWORK_MESSAGE_TIMEOUT_MILLS, ERROR_TYPE } from '../../../../../constants/constants.js';

class PublishParanetInitCommand extends ProtocolInitCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_STORE_INIT_ERROR;
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
        return NETWORK_MESSAGE_TIMEOUT_MILLS.PUBLISH.INIT;
    }

    /**
     * Builds default v1_0_0PublishParanetInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0PublishParanetInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PublishParanetInitCommand;
