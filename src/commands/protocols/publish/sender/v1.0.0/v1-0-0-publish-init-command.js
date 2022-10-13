import ProtocolInitCommand from '../../../common/protocol-init-command.js';
import { ERROR_TYPE } from '../../../../../constants/constants.js';

class PublishInitCommand extends ProtocolInitCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.ualService = ctx.ualService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_STORE_INIT_ERROR;
    }

    async prepareMessage(command) {
        const { assertionId, blockchain, contract, tokenId } = command.data;

        return { assertionId, ual: this.ualService.deriveUAL(blockchain, contract, tokenId) };
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
