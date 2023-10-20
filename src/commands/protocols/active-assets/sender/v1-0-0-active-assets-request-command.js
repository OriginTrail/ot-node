import ProtocolRequestCommand from '../../common/protocol-request-command';

class ActiveAssetsRequestCommand extends ProtocolRequestCommand {
    async prepareMessage() {
        return {};
    }

    async handleAck(/* command, responseData */) {
        // handle recived data
    }

    messageTimeout() {
        // timeout
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
