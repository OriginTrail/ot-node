import ProtocolInitCommand from '../../../common/protocol-init-command.js';
import { NETWORK_MESSAGE_TIMEOUT_MILLS, ERROR_TYPE } from '../../../../../constants/constants.js';

class UpdateInitCommand extends ProtocolInitCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.updateService;

        this.errorType = ERROR_TYPE.UPDATE.UPDATE_STORE_INIT_ERROR;
    }

    messageTimeout() {
        return NETWORK_MESSAGE_TIMEOUT_MILLS.UPDATE.INIT;
    }

    /**
     * Builds default v1_0_0UpdateInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0UpdateInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default UpdateInitCommand;
