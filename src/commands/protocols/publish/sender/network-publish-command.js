const NetworkProtocolCommand = require('../../common/network-protocol-command');

class NetworkPublishCommand extends NetworkProtocolCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
    }

    getKeywords(command) {
        const { assertionId } = command.data;
        return [assertionId];
    }

    getNextCommandData(command) {
        const { assertionId, ual, metadata } = command.data;
        return {
            assertionId,
            ual,
            metadata,
        };
    }

    /**
     * Builds default networkPublishCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'networkPublishCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = NetworkPublishCommand;
