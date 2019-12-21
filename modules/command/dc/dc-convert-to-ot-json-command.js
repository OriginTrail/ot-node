const Command = require('../command');
const ImportUtilities = require('../../ImportUtilities');

class DcConvertToOtJsonCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.importWorkerController = ctx.importWorkerController;
        this.commandExecutor = ctx.command;
        this.config = ctx.config;
        this.web3 = ctx.web3;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { standard_id } = command.data;
        if (standard_id === 'ot-json') {
            command.data.document = JSON.parse(command.data.document);
            if (!command.data.document.signature) { command.data.document = ImportUtilities.prepareDataset(command.data.document['@graph'], this.config, this.web3); }
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
