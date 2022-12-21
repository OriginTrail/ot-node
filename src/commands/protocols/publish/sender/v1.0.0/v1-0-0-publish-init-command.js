import ProtocolInitCommand from '../../../common/protocol-init-command.js';
import { NETWORK_MESSAGE_TIMEOUT_MILLS, ERROR_TYPE } from '../../../../../constants/constants.js';

class PublishInitCommand extends ProtocolInitCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_STORE_INIT_ERROR;
    }

    async prepareMessage(command) {
        const { assertionId, blockchain, contract, tokenId, keyword, hashFunctionId } =
            command.data;

        return { assertionId, blockchain, contract, tokenId, keyword, hashFunctionId };
    }

    messageTimeout() {
        return NETWORK_MESSAGE_TIMEOUT_MILLS.PUBLISH.INIT;
    }

    /**
     * Builds default publishInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0PublishInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PublishInitCommand;
