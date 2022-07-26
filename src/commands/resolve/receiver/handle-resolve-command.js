const { NETWORK_PROTOCOLS } = require('../../../constants/constants');
const HandleProtocolMessageCommand = require('../../common/handle-protocol-message-command');

class HandleResolveCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.networkProtocol = NETWORK_PROTOCOLS.RESOLVE;
    }
}

module.exports = HandleResolveCommand;
