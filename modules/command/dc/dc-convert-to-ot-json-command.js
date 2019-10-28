const Command = require('../command');

class DcConvertToOtJson extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.importWorkerController = ctx.importWorkerController;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { standard_id } = command.data;
        if (standard_id === 'ot-json') {
            return this.continueSequence({ data: command.data }, command.sequence);
        }
        await this.importWorkerController.startOtjsonConverterWorker(command, standard_id);
        return Command.empty();
    }

    /**
     * Builds default dcOfferCreateDbCommand
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

module.exports = DcConvertToOtJson;
