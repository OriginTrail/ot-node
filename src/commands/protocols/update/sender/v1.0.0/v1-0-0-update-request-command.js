import ProtocolRequestCommand from '../../../common/protocol-request-command.js';
import { NETWORK_MESSAGE_TIMEOUT_MILLS, ERROR_TYPE } from '../../../../../constants/constants.js';

class UpdateRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.updateService;

        this.errorType = ERROR_TYPE.UPDATE.UPDATE_REQUEST_ERROR;
    }

    async prepareMessage(command) {
        const data = await this.operationIdService.getCachedOperationIdData(
            command.data.operationId,
        );
        const { assertion } = data.public;

        return {
            assertion,
        };
    }

    messageTimeout() {
        return NETWORK_MESSAGE_TIMEOUT_MILLS.UPDATE.REQUEST;
    }

    /**
     * Builds default v1_0_0UpdateRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0UpdateRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default UpdateRequestCommand;
