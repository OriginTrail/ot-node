const HandleStoreCommand = require('./handle-store-command');
const { NETWORK_MESSAGE_TYPES } = require('../../../constants/constants');

class HandleStoreInitCommand extends HandleStoreCommand {
    async prepareMessage(commandData) {
        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: {} };
    }

    /**
     * Builds default handleStoreInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'handleStoreInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = HandleStoreInitCommand;
