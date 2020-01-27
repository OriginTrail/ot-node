const Command = require('../command');

class DcConvertToGraphCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.importWorkerController = ctx.importWorkerController;
        this.commandExecutor = ctx.commandExecutor;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        try {
            await this.importWorkerController.startGraphConverterWorker(command);
        } catch (error) {
            await this.commandExecutor.add({
                name: 'dcFinalizeImportCommand',
                delay: 0,
                transactional: false,
                data: {
                    error: { message: error.message },
                    handler_id: command.data.handler_id,
                    documentPath: command.data.documentPath,
                },
            });
        }
        return Command.empty();
    }

    /**
     * Builds default dcConvertToGraphCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcConvertToGraphCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DcConvertToGraphCommand;
