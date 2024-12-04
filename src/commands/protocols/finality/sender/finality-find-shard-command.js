import FindShardCommand from '../../common/find-shard-command.js';

class FinalityFindShardCommand extends FindShardCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.finalityService;
    }

    // eslint-disable-next-line no-unused-vars
    getOperationCommandSequence(nodePartOfShard) {
        return [];
    }

    /**
     * Builds default finalityFindShardCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'finalityFindShardCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default FinalityFindShardCommand;
