import ProtocolInitCommand from '../../../common/protocol-init-command.js';
import { NETWORK_MESSAGE_TIMEOUT_MILLS, ERROR_TYPE } from '../../../../../constants/constants.js';

class PublishParanetInitCommand extends ProtocolInitCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishParanetService;

        this.errorType = ERROR_TYPE.PUBLISH_PARANET.PUBLISH_PARANET_STORE_INIT_ERROR;
    }

    async prepareMessage(command) {
        const { contract, tokenId, keyword, hashFunctionId, operationId } = command.data;
        const assertions = await this.operationIdService.getCachedOperationIdData(operationId);
        const publicAssertionId = assertions.cachedAssertions.public.assertionId;
        const privateAssertionId = assertions.cachedAssertions.private.assertionId;
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
