import FindNodesCommand from './find-nodes-command.js';

class FindNodesLocalCommand extends FindNodesCommand {
    async findNodes(keyword, networkProtocol) {
        return this.networkModuleManager.findNodesLocal(keyword, networkProtocol);
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
