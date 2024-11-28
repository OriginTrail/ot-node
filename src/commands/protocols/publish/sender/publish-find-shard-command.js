import FindShardCommand from '../../common/find-shard-command.js';

class PublishFindShardCommand extends FindShardCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
    }

    getLocalCommand() {
        return 'localStoreCommand';
    }

    /**
     * Builds default publishFindShardCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'publishFindShardCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PublishFindShardCommand;
