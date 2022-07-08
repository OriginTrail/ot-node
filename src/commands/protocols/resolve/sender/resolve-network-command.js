const ProtocolNetworkCommand = require('../../common/protocol-network-command');

class ResolveNetworkCommand extends ProtocolNetworkCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.resolveService;
    }

    getKeywords(command) {
        const { assertionId } = command.data;
        return [assertionId];
    }

    getNextCommandData(command) {
        const { assertionId, ual } = command.data;
        return {
            assertionId,
            ual,
        };
    }

    /**
     * Builds default resolveNetworkCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'resolveNetworkCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ResolveNetworkCommand;
