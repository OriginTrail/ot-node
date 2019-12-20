const Command = require('../command');

class DcConvertToOtJsonCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.importWorkerController = ctx.importWorkerController;
        this.commandExecutor = ctx.command;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { standard_id } = command.data;
        if (standard_id === 'ot-json') {
            command.data.document = JSON.parse(command.data.document);
            return this.continueSequence(command.data, command.sequence);
        }
        try {
            await this.importWorkerController.startOtjsonConverterWorker(command, standard_id);
        } catch (error) {
            await this.commandExecutor.add({
                name: 'dcFinalizeImportCommand',
                delay: 0,
                transactional: false,
                data: {
                    error: { message: error.message },
                    handler_id: command.data.handler_id,
                },
            });
        }
        return Command.empty();
    }

    /**
     * Builds default dcConvertToOtJsonCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcConvertToOtJsonCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DcConvertToOtJsonCommand;
