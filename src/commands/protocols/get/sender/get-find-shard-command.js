import FindShardCommand from '../../common/find-shard-command.js';

class GetFindShardCommand extends FindShardCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.getService;
    }

    getOperationCommandSequence(nodePartOfShard) {
        const sequence = [];
        if (nodePartOfShard) {
            sequence.push('localGetCommand');
        }
        sequence.push('networkGetCommand');

        return sequence;
    }

    /**
     * Builds default getFindShardCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'getFindShardCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default GetFindShardCommand;
