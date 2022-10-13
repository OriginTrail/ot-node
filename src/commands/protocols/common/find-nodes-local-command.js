import FindNodesCommand from './find-nodes-command.js';
import { OPERATION_ID_STATUS } from '../../../constants/constants.js';

class FindNodesLocalCommand extends FindNodesCommand {
    async findNodes(keyword, operationId) {
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.FIND_NODES_LOCAL_START,
        );

        const closestNodes = await this.networkModuleManager.findNodesLocal(keyword);

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.FIND_NODES_LOCAL_END,
        );

        return closestNodes;
    }

    /**
     * Builds default findNodesLocalCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'findNodesLocalCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default FindNodesLocalCommand;
