import Command from '../../command.js';

class PublishfinalitySendAckCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.protocolService = ctx.protocolService;
        this.operationService = ctx.publishFinalityService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { operationId, blockchain, remotePeerId, publishOperationId, ual } = command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            this.startEvent,
        );

        this.logger.debug(
            `Trying to ${this.operationService.getOperationName()} to peer ${remotePeerId}`,
        );

        const networkProtocols = this.operationService.getNetworkProtocols();
        const node = { id: remotePeerId, protocol: networkProtocols[0] };
        const commandSequence = this.protocolService.getSenderCommandSequence(node.protocol);
        await this.commandExecutor.add({
            name: commandSequence[0],
            sequence: commandSequence.slice(1),
            delay: 0,
            data: {
                ...this.getNextCommandData(command),
                blockchain,
                operationId,
                node,
                ual,
                publishOperationId,
            },
            period: 5000,
            retries: 3,
            transactional: false,
        });

        return Command.empty();
    }

    /**
     * Builds default publishfinalitySendAckCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'publishfinalitySendAckCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PublishfinalitySendAckCommand;
