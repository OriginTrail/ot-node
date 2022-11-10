import Command from '../../../command.js';

class CalculateProofsCommand extends Command {
    async execute() {
        // calculate proofs
        const proofs = {};

        const submitProofsCommadDelay = 10;

        const commandData = {
            proofs,
        };
        await this.commandExecutor.add({
            name: 'submitProofsCommand',
            delay: submitProofsCommadDelay,
            data: commandData,
            transactional: false,
        });
    }

    /**
     * Builds default handleStoreInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'calculateProofsCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default CalculateProofsCommand;
