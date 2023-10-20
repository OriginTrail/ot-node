import ProtocolRequestCommand from '../../../common/protocol-request-command.js';
import {
    NETWORK_MESSAGE_TIMEOUT_MILLS,
    ERROR_TYPE,
    OPERATION_REQUEST_STATUS,
} from '../../../../../constants/constants.js';

class ActiveAssetsRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.getService;

        // TODO: add const
        this.errorType = ERROR_TYPE.ACTIVE_ASSETS.ACTIVEASSETS_REQUEST_ERROR;
    }

    // eslint-disable-next-line no-unused-vars
    async prepareMessage(command) {
        return {};
    }

    async handleAck(command, responseData) {
        // TODO: add right guard
        if (responseData.success) {
            try {
                // handle recived data
            } catch (e) {
                return this.handleNack(command, {
                    errorMessage: e.message,
                });
            }

            await this.operationService.processResponse(
                command,
                OPERATION_REQUEST_STATUS.COMPLETED,
                responseData,
            );

            return ProtocolRequestCommand.empty();
        }

        return this.handleNack(command, responseData);
    }

    messageTimeout() {
        // TODO: add const
        return NETWORK_MESSAGE_TIMEOUT_MILLS.ACTIVE_ASSETS.REQUEST;
    }

    /**
     * Builds default activeAssetsRequest
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0ActiveAssetsRequestCommand',
            delay: 0,
            retries: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default ActiveAssetsRequestCommand;
