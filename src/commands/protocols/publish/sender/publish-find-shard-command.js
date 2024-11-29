import FindShardCommand from '../../common/find-shard-command.js';

class PublishFindShardCommand extends FindShardCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
    }

    getOperationCommandSequence(nodePartOfShard) {
        const sequence = [];
        sequence.push('publishValidateAssetCommand');
        if (nodePartOfShard) {
            sequence.push('localStoreCommand');
        }
        sequence.push('networkPublishCommand');

        return sequence;
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
