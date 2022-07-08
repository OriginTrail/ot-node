const ProtocolNetworkCommand = require('../../common/protocol-network-command');

class PublishNetworkCommand extends ProtocolNetworkCommand {
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
     * Builds default publishNetworkCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'publishNetworkCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = PublishNetworkCommand;
