import FindShardCommand from '../../common/find-shard-command.js';
import { OPERATION_ID_STATUS, ERROR_TYPE } from '../../../../constants/constants.js';

class PublishFindShardCommand extends FindShardCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.errorType = ERROR_TYPE.FIND_SHARD.PUBLISH_FIND_SHARD_ERROR;
        this.operationStartEvent = OPERATION_ID_STATUS.PUBLISH.PUBLISH_FIND_NODES_START;
        this.operationEndEvent = OPERATION_ID_STATUS.PUBLISH.PUBLISH_FIND_NODES_END;
        this.getMinAckResponsesStartEvent =
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_FIND_NODES_GET_MIN_ACK_RESPONSES_START;
        this.getMinAckResponsesEndEvent =
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_FIND_NODES_GET_MIN_ACK_RESPONSES_END;
        this.findShardNodesStartEvent =
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_FIND_NODES_FIND_SHARD_NODES_START;
        this.findShardNodesEndEvent =
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_FIND_NODES_FIND_SHARD_NODES_END;
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
