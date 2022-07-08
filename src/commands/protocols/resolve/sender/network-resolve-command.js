const NetworkProtocolCommand = require('../../common/network-protocol-command');

class NetworkResolveCommand extends NetworkProtocolCommand {
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
     * Builds default networkResolveCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'networkResolveCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = NetworkResolveCommand;
