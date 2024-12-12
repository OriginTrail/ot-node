import { COMMAND_PRIORITY } from '../../../../constants/constants.js';
import Command from '../../../command.js';

class FindPublisherNodeCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.finalityService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { remotePeerId } = command.data;

        const networkProtocols = this.operationService.getNetworkProtocols();
        const leftoverNodes = [{ id: remotePeerId, protocol: networkProtocols[0] }];

        return this.continueSequence(
            {
                ...command.data,
                leftoverNodes,
                numberOfShardNodes: leftoverNodes.length,
            },
            command.sequence,
        );
    }

    /**
     * Builds default findPublisherNodeCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'findPublisherNodeCommand',
            delay: 0,
            transactional: false,
            priority: COMMAND_PRIORITY.HIGHEST,
        };
        Object.assign(command, map);
        return command;
    }
}

export default FindPublisherNodeCommand;
