const Command = require('../../command');
const { NETWORK_PROTOCOLS } = require('../../../constants/constants');
const HandleProtocolMessageCommand = require('../../common/handle-protocol-message-command');

class HandleResolveCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.resolveService = ctx.resolveService;

        this.networkProtocol = NETWORK_PROTOCOLS.RESOLVE;
    }

    async handleError(handlerId, errorMessage, errorName, markFailed, commandData) {
        await this.resolveService.handleReceiverCommandError(
            handlerId,
            errorMessage,
            errorName,
            markFailed,
            commandData,
        );
        return Command.empty();
    }
}

module.exports = HandleResolveCommand;
