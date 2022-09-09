const Command = require('../command.js');

/**
 * Increases approval for Bidding contract on blockchain
 */
class CommandsCleanerCommand extends Command {


    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'commandsCleanerCommand',
            data: {},
            period: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = CommandsCleanerCommand;
