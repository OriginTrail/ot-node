import ProtocolInitCommand from '../../common/protocol-init-command.js';
import { ERROR_TYPE, OPERATION_REQUEST_STATUS } from '../../../../constants/constants.js';
import Command from '../../../command.js';

class GetInitCommand extends ProtocolInitCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.getService;

        this.errorType = ERROR_TYPE.GET.GET_INIT_ERROR;
    }

    async prepareMessage(command) {
        const { assertionId } = command.data;

        return { assertionId };
    }

    async handleNack(command, responseData) {
        await this.operationService.processResponse(
            command,
            OPERATION_REQUEST_STATUS.FAILED,
            responseData,
        );
        return Command.empty();
    }

    /**
     * Builds default getInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'getInitCommand',
            delay: 0,
            retries: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default GetInitCommand;
