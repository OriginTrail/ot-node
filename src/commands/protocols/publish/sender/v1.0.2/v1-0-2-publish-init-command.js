import ProtocolInitCommand from '../../../common/protocol-init-command.js';
import { ERROR_TYPE } from '../../../../../constants/constants.js';

class PublishInitCommand extends ProtocolInitCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_STORE_INIT_ERROR;
    }

    async prepareMessage(command) {
        const { assertionId, blockchain, contract, tokenId, keyword, hashingAlgorithm } =
            command.data;

        return { assertionId, blockchain, contract, tokenId, keyword, hashingAlgorithm };
    }

    /**
     * Builds default publishInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_2PublishInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PublishInitCommand;
